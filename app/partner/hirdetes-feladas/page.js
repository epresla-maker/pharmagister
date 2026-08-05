"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RouteGuard from "@/app/components/RouteGuard";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { getClientMarket } from "@/lib/marketI18n";
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";

const CATEGORY_OPTIONS = [
  { id: "pharmacy_equipment", label: "Gyógyszertári eszköz" },
  { id: "medical_devices", label: "Orvostechnika" },
  { id: "it_equipment", label: "IT eszköz" },
  { id: "services", label: "Szolgáltatás" },
  { id: "other", label: "Egyéb" },
];

const CONDITION_OPTIONS = [
  { id: "new", label: "Új" },
  { id: "used", label: "Használt" },
  { id: "refurbished", label: "Felújított" },
];

export default function PartnerListingComposerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userData, loading } = useAuth();

  const editId = searchParams.get("edit");
  const isEditMode = Boolean(editId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("pharmacy_equipment");
  const [condition, setCondition] = useState("used");
  const [price, setPrice] = useState("");
  const [negotiable, setNegotiable] = useState(false);
  const [location, setLocation] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [tags, setTags] = useState("");
  const [existingImages, setExistingImages] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [newImagePreviews, setNewImagePreviews] = useState([]);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loadingDraft, setLoadingDraft] = useState(false);

  const isMarketplacePartner = useMemo(
    () =>
      Boolean(
        userData?.partnerAdvertiser ||
          userData?.accountType === "partner_advertiser" ||
          userData?.accountType === "partner_marketplace"
      ),
    [userData]
  );

  useEffect(() => {
    if (!isEditMode || !editId || !user?.uid) return;

    const loadExisting = async () => {
      setLoadingDraft(true);
      setLoadError("");
      try {
        const snap = await getDoc(doc(db, "equipmentMarketplacePosts", editId));
        if (!snap.exists()) {
          setLoadError("A hirdetés nem található.");
          return;
        }

        const data = snap.data();
        if (data.sellerId !== user.uid || !["partner_advertiser", "partner_marketplace"].includes(String(data.sellerType || ""))) {
          setLoadError("Ehhez a hirdetéshez nincs hozzáférésed.");
          return;
        }

        setTitle(data.title || "");
        setDescription(data.description || "");
        setCategory(data.category || data.equipmentCategory || "other");
        setCondition(data.condition || "used");
        setPrice(data.priceAmount != null ? String(data.priceAmount) : data.price != null ? String(data.price) : "");
        setNegotiable(Boolean(data.negotiable) || data.priceType === "negotiable");
        setLocation(data.location || data.city || "");
        setPostalCode(data.postalCode || data.zipCode || "");
        setContactPhone(data.contactPhone || "");
        setTags(Array.isArray(data.tags) ? data.tags.join(", ") : "");
        setExistingImages(
          Array.isArray(data.images)
            ? data.images.filter(Boolean).slice(0, 10)
            : data.imageUrl
            ? [String(data.imageUrl)]
            : []
        );
        setChatEnabled(data.chatEnabled !== false);
      } catch (e) {
        console.error("Partner edit load error:", e);
        setLoadError("Nem sikerült betölteni a hirdetést.");
      } finally {
        setLoadingDraft(false);
      }
    };

    loadExisting();
  }, [isEditMode, editId, user?.uid]);

  const handleImagePick = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const freeSlots = Math.max(0, 10 - existingImages.length - newImages.length);
    if (freeSlots <= 0) {
      setError("Maximum 10 kép tölthető fel.");
      e.target.value = "";
      return;
    }

    const acceptedFiles = [];
    const acceptedPreviews = [];

    for (const file of files.slice(0, freeSlots)) {
      if (!file.type.startsWith("image/")) {
        setError("Csak képfájl tölthető fel.");
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("Egy kép maximum 5MB lehet.");
        continue;
      }
      acceptedFiles.push(file);
      acceptedPreviews.push(URL.createObjectURL(file));
    }

    if (acceptedFiles.length > 0) {
      setNewImages((prev) => [...prev, ...acceptedFiles]);
      setNewImagePreviews((prev) => [...prev, ...acceptedPreviews]);
    }

    e.target.value = "";
  };

  const removeExistingImage = (index) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeNewImage = (index) => {
    setNewImages((prev) => prev.filter((_, i) => i !== index));
    setNewImagePreviews((prev) => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!isMarketplacePartner) {
      setError("Ehhez partner hirdetői jogosultság szükséges.");
      return;
    }

    if (!title.trim() || !description.trim() || !location.trim()) {
      setError("A cím, leírás és helyszín kötelező.");
      return;
    }

    const normalizedPostalCode = String(postalCode || "").trim();
    if (!/^\d{4,5}$/.test(normalizedPostalCode)) {
      setError("Adj meg érvényes irányítószámot (4-5 számjegy).");
      return;
    }

    const parsedPrice = Number(String(price).replace(/\s+/g, "").replace(",", "."));
    const normalizedPrice = Number.isFinite(parsedPrice) ? Math.max(0, Math.round(parsedPrice)) : null;

    let imageList = [...existingImages];

    const tagList = tags
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12);

    const sellerName =
      userData?.partnerProfile?.companyName ||
      userData?.displayName ||
      userData?.email ||
      "Partner hirdető";

    setSubmitting(true);
    try {
      for (const file of newImages) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("userId", user.uid);
        formData.append("folder", "posts");

        const idToken = await user.getIdToken();
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${idToken}` },
          body: formData,
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || !uploadData?.url) {
          throw new Error(uploadData?.error || "Képfeltöltési hiba");
        }

        imageList.push(uploadData.url);
      }

      const payload = {
        title: title.trim(),
        description: description.trim(),
        category,
        equipmentCategory: category,
        condition,
        location: location.trim(),
        city: location.trim(),
        postalCode: normalizedPostalCode,
        zipCode: normalizedPostalCode,
        locationSearchText: `${normalizedPostalCode} ${location.trim()}`.toLowerCase(),
        distanceSearch: {
          postalCode: normalizedPostalCode,
          lat: null,
          lng: null,
          provider: null,
          resolvedAt: null,
        },
        price: negotiable ? null : normalizedPrice,
        priceAmount: negotiable ? null : normalizedPrice,
        priceType: negotiable ? "negotiable" : "fixed",
        negotiable,
        contactPhone: contactPhone.trim(),
        chatEnabled,
        images: imageList,
        imageUrl: imageList[0] || null,
        tags: tagList,
        sellerId: user.uid,
        userId: user.uid,
        sellerName,
        sellerType: "partner_marketplace",
        market: userData?.market || getClientMarket(),
        authorData: {
          displayName: sellerName,
          photoURL: userData?.photoURL || null,
          email: userData?.email || user?.email || null,
        },
        status: "pending",
        featured: false,
        verified: false,
        updatedAt: serverTimestamp(),
      };

      if (isEditMode && editId) {
        await updateDoc(doc(db, "equipmentMarketplacePosts", editId), payload);
      } else {
        await addDoc(collection(db, "equipmentMarketplacePosts"), {
          ...payload,
          views: 0,
          favorites: 0,
          createdAt: serverTimestamp(),
        });
      }

      router.push("/partner/hirdeteseim");
    } catch (e) {
      console.error("Partner submit error:", e);
      setError(e?.message || "Nem sikerült menteni a hirdetést.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RouteGuard>
      <div className="min-h-screen bg-slate-50 px-4 py-6">
        <div className="mx-auto max-w-3xl">
          <div className="mb-5 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900">
              {isEditMode ? "Partner hirdetés szerkesztése" : "Partner hirdetés feladása"}
            </h1>
            <button
              type="button"
              onClick={() => router.push("/partner")}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Vissza
            </button>
          </div>

          {loading || loadingDraft ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-slate-600">Betöltés...</div>
          ) : !isMarketplacePartner ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
              Ehhez a felülethez partner hirdetői fiók szükséges.
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{loadError}</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              {error && <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Hirdetés címe</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Pl. Új gyógyszertári hűtő eladó"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Leírás</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  className="w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Műszaki állapot, átvétel, garancia, fontos részletek"
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Kategória</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {CATEGORY_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Állapot</label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {CONDITION_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Ár (Ft)</label>
                  <input
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    type="number"
                    min="0"
                    disabled={negotiable}
                    className="w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100"
                    placeholder="150000"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Telephely / város</label>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Budapest"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Irányítószám</label>
                <input
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))}
                  inputMode="numeric"
                  maxLength={5}
                  className="w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="1037"
                  required
                />
                <p className="mt-1 text-xs text-slate-500">A távolság alapú keresőhöz ezt is figyelembe vesszük.</p>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={negotiable} onChange={(e) => setNegotiable(e.target.checked)} />
                Ár megegyezés szerint
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Kapcsolattartó telefonszám</label>
                  <input
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="+36..."
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Címkék (vesszővel elválasztva)</label>
                  <input
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="hűtő, gyógyszertár, új"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Képek feltöltése (galériából)</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImagePick}
                  className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-100 file:px-3 file:py-1.5 file:text-emerald-800"
                />
                <p className="text-xs text-slate-500">Maximum 10 kép, képenként legfeljebb 5MB.</p>

                {(existingImages.length > 0 || newImagePreviews.length > 0) && (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {existingImages.map((url, idx) => (
                      <div key={`existing-${idx}`} className="relative overflow-hidden rounded-lg border border-slate-200">
                        <img src={url} alt="Feltöltött kép" className="h-24 w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeExistingImage(idx)}
                          className="absolute right-1 top-1 rounded bg-black/70 px-2 py-1 text-xs font-semibold text-white"
                        >
                          Törlés
                        </button>
                      </div>
                    ))}
                    {newImagePreviews.map((preview, idx) => (
                      <div key={`new-${idx}`} className="relative overflow-hidden rounded-lg border border-slate-200">
                        <img src={preview} alt="Új kép" className="h-24 w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeNewImage(idx)}
                          className="absolute right-1 top-1 rounded bg-black/70 px-2 py-1 text-xs font-semibold text-white"
                        >
                          Törlés
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={chatEnabled} onChange={(e) => setChatEnabled(e.target.checked)} />
                Chat engedélyezése érdeklődőknek
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {submitting
                  ? "Mentés..."
                  : isEditMode
                  ? "Hirdetés frissítése"
                  : "Hirdetés beküldése jóváhagyásra"}
              </button>

              <p className="text-xs text-slate-500">
                A partner hirdetések a Pharmagister piactéren jelennek meg jóváhagyás után.
              </p>
            </form>
          )}
        </div>
      </div>
    </RouteGuard>
  );
}
