import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, RefreshControl } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import type { Pick } from '@/lib/supabase';

type PickWithGame = Pick & { 
  games: {
    home: string;
    away: string;
    kickoff: string;
    status: string;
  };
};

type WeeklyPicks = {
  week: number;
  season: number;
  picks: PickWithGame[];
};

export default function MemberPicksScreen() {
  const { userId, leagueId, userName } = useLocalSearchParams<{ 
    userId: string; 
    leagueId: string;
    userName: string;
  }>();
  const [weeklyPicks, setWeeklyPicks] = useState<WeeklyPicks[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    if (userId && leagueId) {
      getCurrentUser();
      fetchMemberPicks();
    }
  }, [userId, leagueId]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const fetchMemberPicks = async () => {
    try {
      setRefreshing(true);

      const { data, error } = await supabase
        .from('picks')
        .select(`
          *,
          games:game_id (
            home,
            away,
            kickoff,
            status
          )
        `)
        .eq('league_id', leagueId)
        .eq('user_id', userId)
        .order('season', { ascending: false })
        .order('week', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Group picks by week and season
      const groupedPicks: { [key: string]: WeeklyPicks } = {};
      
      (data || []).forEach((pick: any) => {
        const key = `${pick.season}-${pick.week}`;
        if (!groupedPicks[key]) {
          groupedPicks[key] = {
            week: pick.week,
            season: pick.season,
            picks: []
          };
        }
        groupedPicks[key].picks.push(pick);
      });
      
      // Convert to array and sort by most recent
      const weeklyPicksArray = Object.values(groupedPicks).sort((a, b) => {
        if (a.season !== b.season) return b.season - a.season;
        return b.week - a.week;
      });
      
      setWeeklyPicks(weeklyPicksArray);
    } catch (error) {
      console.error('Error fetching member picks:', error);
      Alert.alert('Error', 'Failed to load member picks');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const isPickVisible = (pick: Pick) => {
    // User can always see their own picks
    if (currentUserId === userId) {
      return true;
    }

    // If no unlock_at, pick is always visible
    if (!pick.unlock_at) {
      return true;
    }

    // Check if current time is after unlock_at
    const now = new Date();
    const unlockTime = new Date(pick.unlock_at);
    return now >= unlockTime;
  };

  const renderPick = ({ item }: { item: PickWithGame }) => {
    const visible = isPickVisible(item);

    const getStatusColor = () => {
      if (!visible) return '#6c757d';
      if (item.result === 'WIN') return '#28a745';
      if (item.result === 'LOSS') return '#dc3545';
      if (item.result === 'PUSH') return '#ffc107';
      if (item.locked) return '#6c757d';
      return '#007bff';
    };

    const getStatusText = () => {
      if (!visible) return 'LOCKED';
      if (item.result) return item.result;
      if (item.locked) return 'LOCKED';
      return 'PENDING';
    };

    const getStatusIcon = () => {
      if (!visible) return '🔒';
      if (item.result === 'WIN') return '✅';
      if (item.result === 'LOSS') return '❌';
      if (item.result === 'PUSH') return '➖';
      if (item.locked) return '🔒';
      return '⏳';
    };

    return (
      <View style={styles.pickCard}>
        <View style={styles.pickHeader}>
          <View style={styles.gameInfo}>
            <Text style={styles.gameText}>
              {item.games?.away} @ {item.games?.home}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
            <Text style={styles.statusText}>{getStatusIcon()} {getStatusText()}</Text>
          </View>
        </View>
        
        <View style={styles.pickDetails}>
          {visible ? (
            <>
              <Text style={styles.pickText}>
                Picked: <Text style={styles.pickSide}>{item.side}</Text> ({item.line_value > 0 ? '+' : ''}{item.line_value})
              </Text>
              {item.points !== undefined && (
                <Text style={[styles.pointsText, { color: item.points > 0 ? '#28a745' : '#dc3545' }]}>
                  Points: {item.points > 0 ? '+' : ''}{item.points}
                </Text>
              )}
              {!item.result && (
                <Text style={styles.pendingText}>
                  {item.locked ? 'Waiting for game result' : 'Pick submitted'}
                </Text>
              )}
            </>
          ) : (
            <View style={styles.lockedPickInfo}>
              <Text style={styles.lockedText}>🔒 Pick Hidden</Text>
              <Text style={styles.lockedSubtext}>
                Picks unlock Saturday at 12:00 PM ET
              </Text>
              {item.unlock_at && (
                <Text style={styles.unlockTime}>
                  Unlocks: {new Date(item.unlock_at).toLocaleDateString()} at {new Date(item.unlock_at).toLocaleTimeString()}
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderWeekSection = ({ item }: { item: WeeklyPicks }) => {
    const visiblePicks = item.picks.filter(isPickVisible);
    const weekWins = visiblePicks.filter(p => p.result === 'WIN').length;
    const weekLosses = visiblePicks.filter(p => p.result === 'LOSS').length;
    const weekPushes = visiblePicks.filter(p => p.result === 'PUSH').length;
    const weekPending = visiblePicks.filter(p => !p.result).length;
    const lockedCount = item.picks.length - visiblePicks.length;
    
    return (
      <View style={styles.weekSection}>
        <View style={styles.weekHeader}>
          <Text style={styles.weekTitle}>Week {item.week}, {item.season}</Text>
          <View style={styles.weekStats}>
            {weekWins > 0 && <Text style={styles.weekWins}>{weekWins}W</Text>}
            {weekLosses > 0 && <Text style={styles.weekLosses}>{weekLosses}L</Text>}
            {weekPushes > 0 && <Text style={styles.weekPushes}>{weekPushes}P</Text>}
            {weekPending > 0 && <Text style={styles.weekPending}>{weekPending} pending</Text>}
            {lockedCount > 0 && <Text style={styles.weekLocked}>{lockedCount} locked</Text>}
          </View>
        </View>
        
        {item.picks.map((pick, index) => (
          <View key={`${pick.league_id}-${pick.game_id}`} style={styles.pickInWeek}>
            {renderPick({ item: pick })}
          </View>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text>Loading picks...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{userName || 'Member'}'s Picks</Text>
        <Text style={styles.subtitle}>
          {currentUserId === userId ? 'Your picks' : 'Picks unlock Saturday 12:00 PM ET'}
        </Text>
      </View>
      
      {weeklyPicks.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No picks found</Text>
          <Text style={styles.emptySubtext}>This member hasn't made any picks yet</Text>
        </View>
      ) : (
        <FlatList
          data={weeklyPicks}
          renderItem={renderWeekSection}
          keyExtractor={(item) => `${item.season}-${item.week}`}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={fetchMemberPicks}
              colors={['#007AFF']}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
  weekSection: {
    marginBottom: 20,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f1f3f4',
    borderRadius: 8,
    marginBottom: 8,
    marginHorizontal: 16,
  },
  weekTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  weekStats: {
    flexDirection: 'row',
    gap: 8,
  },
  weekWins: {
    fontSize: 12,
    fontWeight: '600',
    color: '#28a745',
    backgroundColor: '#d4edda',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  weekLosses: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc3545',
    backgroundColor: '#f8d7da',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  weekPushes: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffc107',
    backgroundColor: '#fff3cd',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  weekPending: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6c757d',
    backgroundColor: '#e9ecef',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  weekLocked: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc3545',
    backgroundColor: '#f8d7da',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pickInWeek: {
    marginBottom: 8,
    marginHorizontal: 16,
  },
  pickCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  pickHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  gameInfo: {
    flex: 1,
  },
  gameText: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  pickDetails: {
    marginBottom: 8,
  },
  pickText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  pickSide: {
    fontWeight: '700',
    color: '#007AFF',
  },
  pointsText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  pendingText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 2,
  },
  lockedPickInfo: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  lockedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc3545',
    marginBottom: 4,
  },
  lockedSubtext: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  unlockTime: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});