export const metadata = {
  title: "Pharmagister - Gyógyszertári Helyettesítés",
  description: "Gyógyszertári helyettesítési platform. Kösd össze a gyógyszertárakat és a helyettesítőket.",
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
