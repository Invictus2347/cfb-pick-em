import React from 'react';
import { View, Text } from 'react-native';
import { LeagueSlateLine } from '../lib/supabase';

interface WindowingBannerProps {
  games: Array<{ line: LeagueSlateLine }>;
  season: number;
  week: number;
}

export default function WindowingBanner({ games, season, week }: WindowingBannerProps) {
  // Check if any games have lines available
  const hasLinesAvailable = games.some(g => g.line.lines_available);
  
  if (hasLinesAvailable) {
    return null; // Don't show banner if lines are already available
  }

  // Analyze the window pattern to determine when lines will drop
  const windowCounts = games.reduce((acc, game) => {
    const window = game.line.publish_window || 'MAIN';
    acc[window] = (acc[window] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Determine the primary window for this set of games
  let primaryWindow = 'MAIN';
  let maxCount = 0;
  Object.entries(windowCounts).forEach(([window, count]) => {
    if (count > maxCount) {
      maxCount = count;
      primaryWindow = window;
    }
  });

  // Calculate next drop time based on window
  const getNextDropTime = (window: string): string => {
    // Calculate the approximate drop time
    // Week 1 starts around Aug 24, 2025
    const seasonStart = new Date(season, 7, 24); // Aug 24
    const weekStart = new Date(seasonStart.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
    
    let dropDay = new Date(weekStart);
    let dropDescription = '';
    
    switch (window) {
      case 'LABORDAY':
        // Monday 10:00 AM ET
        dropDay.setDate(weekStart.getDate() + 1); // Monday
        dropDay.setHours(10, 0, 0, 0);
        dropDescription = 'Mon 10:00 AM ET';
        break;
      case 'EARLY':
        // Tuesday 10:00 AM ET (for Tue/Wed games)
        dropDay.setDate(weekStart.getDate() + 2); // Tuesday
        dropDay.setHours(10, 0, 0, 0);
        dropDescription = 'Tue 10:00 AM ET';
        break;
      case 'MAIN':
      default:
        // Thursday 10:00 AM ET (for Thu-Sun games)
        dropDay.setDate(weekStart.getDate() + 4); // Thursday
        dropDay.setHours(10, 0, 0, 0);
        dropDescription = 'Thu 10:00 AM ET';
        break;
    }

    return dropDescription;
  };

  const dropTime = getNextDropTime(primaryWindow);
  
  // Determine banner message and color
  const getBannerInfo = (window: string) => {
    switch (window) {
      case 'LABORDAY':
        return {
          message: `Week ${week} Labor Day lines drop ${dropTime}`,
          subtitle: 'Monday games available soon',
          bgColor: 'bg-red-100',
          textColor: 'text-red-800',
          borderColor: 'border-red-300'
        };
      case 'EARLY':
        return {
          message: `Week ${week} MACtion lines drop ${dropTime}`,
          subtitle: 'Tuesday/Wednesday games available soon',
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-800',
          borderColor: 'border-yellow-300'
        };
      case 'MAIN':
      default:
        return {
          message: `Week ${week} lines drop ${dropTime}`,
          subtitle: 'Main slate games available soon',
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-800',
          borderColor: 'border-blue-300'
        };
    }
  };

  const bannerInfo = getBannerInfo(primaryWindow);

  return (
    <View className={`mx-4 mb-4 p-4 rounded-lg border ${bannerInfo.bgColor} ${bannerInfo.borderColor}`}>
      <Text className={`text-lg font-bold ${bannerInfo.textColor}`}>
        📅 {bannerInfo.message}
      </Text>
      <Text className={`text-sm mt-1 ${bannerInfo.textColor} opacity-80`}>
        {bannerInfo.subtitle}
      </Text>
      
      {/* Show window breakdown if multiple windows */}
      {Object.keys(windowCounts).length > 1 && (
        <View className="mt-2 pt-2 border-t border-gray-300">
          <Text className={`text-xs ${bannerInfo.textColor} opacity-70`}>
            Window breakdown:
          </Text>
          {Object.entries(windowCounts).map(([window, count]) => (
            <Text key={window} className={`text-xs ${bannerInfo.textColor} opacity-70`}>
              • {window}: {count} games → {getNextDropTime(window)}
            </Text>
          ))}
        </View>
      )}
      
      <View className="mt-2 pt-2 border-t border-gray-300">
        <Text className={`text-xs ${bannerInfo.textColor} opacity-70`}>
          ⚡ Lines are locked once published - get ready to make your picks!
        </Text>
      </View>
    </View>
  );
}
