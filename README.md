# CFB Pick'em 🏈

A college football pick'em game built with React Native, Expo, and Supabase. Compete with friends by making picks against the spread and see how you stack up in the standings.

## 🚀 Features

- **League Management**: Create and join private leagues
- **Pick System**: Make picks against the spread for college football games
- **Real-time Standings**: Live leaderboards and statistics
- **Commissioner Tools**: Manage leagues, settings, and members
- **Automatic Updates**: Real-time odds and game data
- **OTA Updates**: Seamless app updates without App Store approval

## 🛠️ Tech Stack

- **Frontend**: React Native with Expo
- **Backend**: Supabase (PostgreSQL + Auth + Real-time)
- **Navigation**: Expo Router
- **State Management**: React Context + Supabase
- **Deployment**: EAS Build + GitHub Actions

## 📱 App Structure

```
app/
├── (tabs)/           # Main tab navigation
│   ├── index.tsx     # Home dashboard
│   ├── league.tsx    # League management
│   └── admin.tsx     # Commissioner tools
├── league/[leagueId]/ # Nested league screens
│   ├── standings.tsx # League standings
│   ├── slate.tsx     # Game slate & picks
│   └── my-picks.tsx  # User's picks
├── member-picks/     # View other players' picks
└── signin.tsx        # Authentication
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI
- Supabase account
- iOS Simulator or device

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Invictus2347/cfb-pick-em.git
   cd cfb-pick-em
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Add your Supabase URL and anon key
   ```

4. **Start the development server**
   ```bash
   npm start
   ```

## 🏗️ Build & Deployment

### iOS Build Pipeline

The app uses EAS Build and GitHub Actions for automated builds and deployments.

#### Build Commands
```bash
# Build for iOS
npm run build:ios

# Submit to App Store
npm run submit:ios

# OTA updates
npm run ota:preview  # Preview channel
npm run ota:prod     # Production channel
```

#### GitHub Actions Workflows

- **Preview OTA**: Automatic updates when pushing to `develop` branch
- **Production OTA**: Automatic updates when pushing version tags (`v*`)
- **iOS Build & Submit**: Automated App Store submission when pushing `build/*` tags

### Release Process

```bash
# OTA to preview
git push origin develop

# OTA to production
git tag v1.0.1 && git push --tags

# Build & submit to App Store
git tag build/ios-1.0.0 && git push --tags
```

## 🔧 Configuration

### Required Environment Variables

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### GitHub Secrets

Add these secrets to your GitHub repository:

- `EXPO_TOKEN`: Expo access token
- `SUPABASE_URL_STAGING`: Staging Supabase URL
- `SUPABASE_ANON_STAGING`: Staging Supabase anon key
- `SUPABASE_URL_PROD`: Production Supabase URL
- `SUPABASE_ANON_PROD`: Production Supabase anon key
- `APPLE_APP_SPECIFIC_PASSWORD`: Apple app-specific password
- `APP_STORE_CONNECT_API_KEY_PATH`: App Store Connect API key (optional)

## 📊 Database Schema

### Core Tables

- **leagues**: League information and settings
- **league_members**: User membership and roles
- **games**: College football games and schedules
- **league_slate_lines**: Game lines and odds for each league
- **picks**: User picks with validation and results

### Key Features

- **Pick Validation**: Prevents picks when lines aren't available
- **Time-based Unlocking**: Picks unlock at scheduled times
- **Role-based Access**: Commissioner vs player permissions
- **Real-time Updates**: Live standings and pick visibility

## 🧪 Testing

```bash
# Run integration tests
npm test

# Test frontend-backend integration
# (Use the test button in the app)
```

## 📱 App Store

### Requirements

- iOS 13.0+
- iPhone only (no iPad support)
- Requires internet connection
- Age Rating: 4+

### Screenshots

- 6.5" iPhone (1290 x 2796 px)
- 5.5" iPhone (1242 x 2208 px)

See `STORE_CHECKLIST.md` for complete App Store submission checklist.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/Invictus2347/cfb-pick-em/issues)
- **Documentation**: [Wiki](https://github.com/Invictus2347/cfb-pick-em/wiki)

## 🏆 Acknowledgments

- College Football Data API for game schedules
- Supabase for backend infrastructure
- Expo for React Native development platform
- React Native community for excellent tooling

---

**CFB Pick'em** - The ultimate college football pick'em experience! 🏈
