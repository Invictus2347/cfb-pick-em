import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import type { Pick, League } from '@/lib/supabase';

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

export default function LeagueMyPicksScreen() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();
  const [league, setLeague] = useState<League | null>(null);
  const [weeklyPicks, setWeeklyPicks] = useState<WeeklyPicks[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (leagueId) {
      loadLeague();
      fetchPicks();
    }
  }, [leagueId]);

  const loadLeague = async () => {
    try {
      const { data, error } = await supabase
        .from('leagues')
        .select('*')
        .eq('id', leagueId)
        .single();

      if (error) throw error;
      setLeague(data);
    } catch (error) {
      console.error('Error loading league:', error);
    }
  };

  const fetchPicks = async () => {
    try {
      setRefreshing(true);
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

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
        .eq('user_id', user.user.id)
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
      console.error('Error fetching picks:', error);
      Alert.alert('Error', 'Failed to load picks');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const deletePick = async (pick: Pick) => {
    if (pick.locked) {
      Alert.alert('Cannot Delete', 'This pick is locked and cannot be modified');
      return;
    }

    Alert.alert(
      'Delete Pick',
      'Are you sure you want to delete this pick?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('picks')
                .delete()
                .eq('league_id', pick.league_id)
                .eq('user_id', pick.user_id)
                .eq('season', pick.season)
                .eq('week', pick.week)
                .eq('game_id', pick.game_id);

              if (error) throw error;
              fetchPicks();
            } catch (error) {
              console.error('Error deleting pick:', error);
              Alert.alert('Error', 'Failed to delete pick');
            }
          },
        },
      ]
    );
  };

  const renderPick = ({ item }: { item: PickWithGame }) => {
    const getStatusColor = () => {
      if (item.result === 'WIN') return '#28a745';
      if (item.result === 'LOSS') return '#dc3545';
      if (item.result === 'PUSH') return '#ffc107';
      if (item.locked) return '#6c757d';
      return '#007bff';
    };

    const getStatusText = () => {
      if (item.result) return item.result;
      if (item.locked) return 'LOCKED';
      return 'PENDING';
    };

    const getStatusIcon = () => {
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
              {item.locked ? 'Waiting for game result' : 'Not submitted yet'}
            </Text>
          )}
        </View>

        {!item.locked && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => deletePick(item)}
          >
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderWeekSection = ({ item }: { item: WeeklyPicks }) => {
    const weekWins = item.picks.filter(p => p.result === 'WIN').length;
    const weekLosses = item.picks.filter(p => p.result === 'LOSS').length;
    const weekPushes = item.picks.filter(p => p.result === 'PUSH').length;
    const weekPending = item.picks.filter(p => !p.result).length;
    
    return (
      <View style={styles.weekSection}>
        <View style={styles.weekHeader}>
          <Text style={styles.weekTitle}>Week {item.week}, {item.season}</Text>
          <View style={styles.weekStats}>
            {weekWins > 0 && <Text style={styles.weekWins}>{weekWins}W</Text>}
            {weekLosses > 0 && <Text style={styles.weekLosses}>{weekLosses}L</Text>}
            {weekPushes > 0 && <Text style={styles.weekPushes}>{weekPushes}P</Text>}
            {weekPending > 0 && <Text style={styles.weekPending}>{weekPending} pending</Text>}
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
        <Text style={styles.title}>My Picks</Text>
        <Text style={styles.subtitle}>{league?.name}</Text>
      </View>
      
      {weeklyPicks.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No picks yet</Text>
          <Text style={styles.emptySubtext}>Go to the Slate tab to make picks</Text>
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
              onRefresh={fetchPicks}
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
  deleteButton: {
    backgroundColor: '#dc3545',
    padding: 8,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});