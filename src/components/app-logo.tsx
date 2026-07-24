type AppLogoProps = {
  className?: string;
};

export function AppLogo({ className = "h-9 w-9" }: AppLogoProps) {
  return (
    <img
      src="/app-logo.svg"
      alt="ShippingLabelsDashboard"
      className={className}
      width="36"
      height="36"
    />
  );
}
