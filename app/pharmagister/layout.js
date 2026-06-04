export const metadata = {
  title: "Pharmagister - Pharmacy Shift Coverage",
  description: "Pharmacy shift coverage platform connecting pharmacies and substitutes.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Pharmagister"
  }
};

export const viewport = {
  themeColor: "#0891b2",
};

export default function PharmagisterLayout({ children }) {
  return <>{children}</>;
}
