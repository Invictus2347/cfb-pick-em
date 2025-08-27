import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { type Game, type LeagueSlateLine, type Pick } from '@/lib/supabase';

type GameWithLine = {
  game: Game;
  line: LeagueSlateLine;
  existingPick?: Pick;
};

interface GameCardProps {
  gameWithLine: GameWithLine;
  onPickSide: (gameId: string, side: 'HOME' | 'AWAY', lineValue: number) => void;
  disabled?: boolean;
}

export default function GameCard({ gameWithLine, onPickSide, disabled = false }: GameCardProps) {
  const { game, line, existingPick } = gameWithLine;
  
  // Format kickoff time
  const kickoffDate = new Date(game.kickoff);
  const isGameStarted = kickoffDate <= new Date();
  const timeString = kickoffDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  });
  const dateString = kickoffDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

  // Check if lines are available for picking
  const linesAvailable = (line as any).lines_available !== false && (line.spread_home !== null || line.spread_away !== null);
  const isSchedulePreview = (line.source === 'cfbd_schedule_preview');
  
  // Determine publish window messaging based on game day
  const getPublishMessage = () => {
    if (linesAvailable) return null; // Lines are already available
    
    const gameDay = kickoffDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    
    if (gameDay === 'MON') {
      return 'Lines drop Mon 10 AM ET';
    } else if (gameDay === 'TUE' || gameDay === 'WED') {
      return `Lines drop ${gameDay.charAt(0) + gameDay.slice(1).toLowerCase()} 10 AM ET`;
    } else {
      return 'Lines drop Thu 10 AM ET';
    }
  };
  
  const publishMessage = getPublishMessage();
  
  // Format spread display
  const getSpreadFallback = () => {
    if (!publishMessage) return 'N/A';
    
    const gameDay = kickoffDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    
    if (gameDay === 'MON') {
      return 'Lines Mon 10 AM';
    } else if (gameDay === 'TUE') {
      return 'Lines Tue 10 AM';
    } else if (gameDay === 'WED') {
      return 'Lines Wed 10 AM';
    } else {
      return 'Lines Thu 10 AM';
    }
  };
  
  const spreadFallback = getSpreadFallback();
  
  const homeSpreadDisplay = line.spread_home 
    ? (line.spread_home > 0 ? `+${line.spread_home}` : line.spread_home.toString())
    : spreadFallback;
  const awaySpreadDisplay = line.spread_away 
    ? (line.spread_away > 0 ? `+${line.spread_away}` : line.spread_away.toString())
    : spreadFallback;

  const handlePickHome = () => {
    if (!disabled && !isGameStarted && linesAvailable && line.spread_home !== null) {
      onPickSide(game.id, 'HOME', line.spread_home);
    }
  };

  const handlePickAway = () => {
    if (!disabled && !isGameStarted && linesAvailable && line.spread_away !== null) {
      onPickSide(game.id, 'AWAY', line.spread_away);
    }
  };

  const isHomePicked = existingPick?.side === 'HOME';
  const isAwayPicked = existingPick?.side === 'AWAY';
  const isLocked = isGameStarted || existingPick?.locked;

  return (
    <View style={[styles.container, isLocked && styles.lockedContainer]}>
      {/* Game Info Header */}
      <View style={styles.header}>
        <Text style={styles.gameTime}>{dateString} • {timeString}</Text>
        {isLocked && (
          <View style={styles.lockedBadge}>
            <Text style={styles.lockedText}>
              {isGameStarted ? 'Started' : 'Locked'}
            </Text>
          </View>
        )}
      </View>

      {/* Schedule Preview Banner */}
      {publishMessage && (
        <View style={styles.previewBanner}>
          <Text style={styles.previewText}>
            📅 Schedule Preview - {publishMessage}
          </Text>
        </View>
      )}

      {/* Teams and Spreads */}
      <View style={styles.gameContainer}>
        {/* Away Team */}
        <TouchableOpacity
          style={[
            styles.teamButton,
            isAwayPicked && styles.selectedTeamButton,
            (disabled || isLocked) && styles.disabledTeamButton
          ]}
          onPress={handlePickAway}
          disabled={disabled || isLocked}
        >
          <View style={styles.teamInfo}>
            <Text style={[
              styles.teamName,
              isAwayPicked && styles.selectedTeamName,
              isLocked && styles.lockedTeamName
            ]}>
              {game.away}
            </Text>
            <Text style={styles.teamLabel}>AWAY</Text>
          </View>
          <View style={[
            styles.spreadPill,
            isAwayPicked && styles.selectedSpreadPill
          ]}>
            <Text style={[
              styles.spreadText,
              isAwayPicked && styles.selectedSpreadText
            ]}>
              {awaySpreadDisplay}
            </Text>
          </View>
        </TouchableOpacity>

        {/* VS Divider */}
        <View style={styles.divider}>
          <Text style={styles.vsText}>VS</Text>
        </View>

        {/* Home Team */}
        <TouchableOpacity
          style={[
            styles.teamButton,
            isHomePicked && styles.selectedTeamButton,
            (disabled || isLocked) && styles.disabledTeamButton
          ]}
          onPress={handlePickHome}
          disabled={disabled || isLocked}
        >
          <View style={styles.teamInfo}>
            <Text style={[
              styles.teamName,
              isHomePicked && styles.selectedTeamName,
              isLocked && styles.lockedTeamName
            ]}>
              {game.home}
            </Text>
            <Text style={styles.teamLabel}>HOME</Text>
          </View>
          <View style={[
            styles.spreadPill,
            isHomePicked && styles.selectedSpreadPill
          ]}>
            <Text style={[
              styles.spreadText,
              isHomePicked && styles.selectedSpreadText
            ]}>
              {homeSpreadDisplay}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Pick Status */}
      {existingPick && (
        <View style={styles.pickStatus}>
          <Text style={styles.pickStatusText}>
            Your pick: {existingPick.side} {existingPick.line_value > 0 ? '+' : ''}{existingPick.line_value}
            {existingPick.result && ` • ${existingPick.result}`}
            {existingPick.points !== undefined && ` (${existingPick.points} pts)`}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lockedContainer: {
    backgroundColor: '#f8f8f8',
    opacity: 0.8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  gameTime: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  lockedBadge: {
    backgroundColor: '#ff6b6b',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  lockedText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  gameContainer: {
    gap: 8,
  },
  teamButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fafafa',
  },
  selectedTeamButton: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  disabledTeamButton: {
    opacity: 0.6,
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  selectedTeamName: {
    color: '#fff',
  },
  lockedTeamName: {
    color: '#666',
  },
  teamLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  spreadPill: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minWidth: 50,
    alignItems: 'center',
  },
  selectedSpreadPill: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  spreadText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  selectedSpreadText: {
    color: '#007AFF',
  },
  divider: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  vsText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  pickStatus: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  pickStatusText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  previewBanner: {
    backgroundColor: '#fff3cd',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  previewText: {
    fontSize: 12,
    color: '#856404',
    textAlign: 'center',
    fontWeight: '500',
  },
}); 