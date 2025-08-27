export default {
  name: "CFB Pick'em",
  slug: "cfb-pickem",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "cfbpickemapp",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  splash: {
    image: "./assets/images/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff"
  },
  ios: {
    bundleIdentifier: "com.invictus2347.cfbpickem",
    supportsTablet: false
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#ffffff"
    },
    edgeToEdgeEnabled: true
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png"
  },
  runtimeVersion: { 
    policy: "appVersion" 
  },
  updates: { 
    url: "https://u.expo.dev/REPLACE_WITH_EAS_PROJECT_ID" 
  },
  extra: {
    env: process.env.APP_ENV,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY
  },
  plugins: [
    "expo-router",
    "expo-secure-store"
  ],
  experiments: {
    typedRoutes: true
  }
};
