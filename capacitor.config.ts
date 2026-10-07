import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.swadhyaya.mobile",
  appName: "Swadhyaya",
  webDir: "out",
  android: {
    allowMixedContent: false,
  },
  plugins: {
    LocalNotifications: {
      iconColor: "#c084fc",
    },
  },
};

export default config;
