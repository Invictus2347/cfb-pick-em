import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase, type League, type WeeklyStanding } from '@/lib/supabase';

type LeagueWithRole = League & { role: 'commish' | 'player' };

type SeasonStanding = {
  user_id: string;
  user_email: string;
  total_wins: number;
  total_losses: number;
  total_pushes: number;
  total_points: number;
  weeks_played: number;
  win_percentage: number;
};

export default function LeagueStandingsScreen() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();
  const [league, setLeague] = useState<LeagueWithRole | null>(null);
  const [weeklyStandings, setWeeklyStandings] = useState<WeeklyStanding[]>([]);
  const [seasonStandings, setSeasonStandings] = useState<SeasonStanding[]>([]);
  const [viewMode, setViewMode] = useState<'weekly' | 'season'>('season');
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentSeason] = useState(2025);

  useEffect(() => {
    if (leagueId) {
      loadLeague();
      loadStandings();
    }
  }, [leagueId, viewMode, selectedWeek]);

  const loadLeague = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get league with user's role
      const { data: memberData, error } = await supabase
        .from('league_members')
        .select(`
          role,
          leagues (
            id,
            name,
            invite_code,
            created_by,
            pick_limit,
            push_points,
            created_at
          )
        `)
        .eq('league_id', leagueId)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      if (memberData?.leagues) {
        const leagueWithRole: LeagueWithRole = {
          ...(memberData.leagues as any),
          role: memberData.role as 'commish' | 'player'
        };
        setLeague(leagueWithRole);
      }
    } catch (error) {
      console.error('Error loading league:', error);
      Alert.alert('Error', 'Failed to load league details');
    }
  };

  const loadStandings = async () => {
    if (!leagueId) return;

    try {
      setLoading(true);

      if (viewMode === 'weekly') {
        // Load weekly standings
        const { data, error } = await supabase
          .from('weekly_standings')
          .select('*')
          .eq('league_id', leagueId)
          .eq('season', currentSeason)
          .eq('week', selectedWeek)
          .order('points', { ascending: false })
          .order('wins', { ascending: false });

        if (error) throw error;
        setWeeklyStandings(data || []);
      } else {
        // Load season standings (aggregated)
        const { data, error } = await supabase
          .from('weekly_standings')
          .select('*')
          .eq('league_id', leagueId)
          .eq('season', currentSeason);

        if (error) throw error;

        // Aggregate by user
        const userMap = new Map<string, SeasonStanding>();
        
        (data || []).forEach(standing => {
          const existing = userMap.get(standing.user_id);
          if (existing) {
            existing.total_wins += standing.wins;
            existing.total_losses += standing.losses;
            existing.total_pushes += standing.pushes;
            existing.total_points += standing.points;
            existing.weeks_played += 1;
          } else {
            userMap.set(standing.user_id, {
              user_id: standing.user_id,
              user_email: standing.user_email || 'Unknown',
              total_wins: standing.wins,
              total_losses: standing.losses,
              total_pushes: standing.pushes,
              total_points: standing.points,
              weeks_played: 1,
              win_percentage: 0,
            });
          }
        });

        // Calculate win percentages and sort
        const seasonData = Array.from(userMap.values()).map(standing => ({
          ...standing,
          win_percentage: standing.total_wins + standing.total_losses > 0 
            ? standing.total_wins / (standing.total_wins + standing.total_losses)
            : 0
        })).sort((a, b) => {
          if (b.total_points !== a.total_points) {
            return b.total_points - a.total_points;
          }
          return b.win_percentage - a.win_percentage;
        });

        setSeasonStandings(seasonData);
      }
    } catch (error) {
      console.error('Error loading standings:', error);
      Alert.alert('Error', 'Failed to load standings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleMemberClick = async (userId: string, userName: string) => {
    if (!leagueId) return;
    
    // Check if viewing own picks
    const { data: { user } } = await supabase.auth.getUser();
    if (user && userId === user.id) {
      // Navigate to own picks tab within this league
      router.push(`/league/${leagueId}/my-picks`);
      return;
    }
    
    // For other users, show their picks with unlock logic
    Alert.alert(
      `${userName}'s Picks`,
      'View this member\'s picks for the league?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'View Picks', 
          onPress: () => {
            router.push(`/member-picks/${userId}?leagueId=${leagueId}&userName=${userName}`);
          }
        }
      ]
    );
  };

  const renderStanding = ({ item, index }: { item: WeeklyStanding | SeasonStanding; index: number }) => {
    const isWeekly = 'wins' in item;
    const userName = (item.user_email || 'Unknown').split('@')[0];
    
    return (
      <TouchableOpacity 
        style={styles.standingRow}
        onPress={() => handleMemberClick(item.user_id, userName)}
        activeOpacity={0.7}
      >
        <View style={styles.rankContainer}>
          <Text style={styles.rank}>{index + 1}</Text>
        </View>
        <View style={styles.userContainer}>
          <Text style={styles.userName}>
            {userName} 👤
          </Text>
          {!isWeekly && (
            <Text style={styles.weeksPlayed}>
              {(item as SeasonStanding).weeks_played} weeks • Tap to view picks
            </Text>
          )}
        </View>
        <View style={styles.statsContainer}>
          <Text style={styles.record}>
            {isWeekly 
              ? `${(item as WeeklyStanding).wins}-${(item as WeeklyStanding).losses}-${(item as WeeklyStanding).pushes}`
              : `${(item as SeasonStanding).total_wins}-${(item as SeasonStanding).total_losses}-${(item as SeasonStanding).total_pushes}`
            }
          </Text>
          <Text style={styles.points}>
            {isWeekly 
              ? (item as WeeklyStanding).points.toFixed(1)
              : (item as SeasonStanding).total_points.toFixed(1)
            } pts
          </Text>
          {!isWeekly && (
            <Text style={styles.percentage}>
              {((item as SeasonStanding).win_percentage * 100).toFixed(1)}%
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const currentStandings = viewMode === 'weekly' ? weeklyStandings : seasonStandings;
  const hasData = currentStandings.length > 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{league?.name || 'League'} Standings</Text>
        <Text style={styles.subtitle}>Season {currentSeason}</Text>
      </View>

      {/* View Mode Selector */}
      <View style={styles.viewModeSelector}>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'weekly' && styles.selectedViewModeButton]}
          onPress={() => setViewMode('weekly')}
        >
          <Text style={[styles.viewModeText, viewMode === 'weekly' && styles.selectedViewModeText]}>
            Weekly
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'season' && styles.selectedViewModeButton]}
          onPress={() => setViewMode('season')}
        >
          <Text style={[styles.viewModeText, viewMode === 'season' && styles.selectedViewModeText]}>
            Season
          </Text>
        </TouchableOpacity>
      </View>

      {/* Week Selector (for weekly view) */}
      {viewMode === 'weekly' && (
        <View style={styles.weekSelector}>
          <Text style={styles.selectorLabel}>Week {selectedWeek}:</Text>
          <View style={styles.weekControls}>
            <TouchableOpacity 
              style={styles.weekButton}
              onPress={() => setSelectedWeek(Math.max(1, selectedWeek - 1))}
              disabled={selectedWeek <= 1}
            >
              <Text style={styles.weekButtonText}>← Prev</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.weekButton}
              onPress={() => setSelectedWeek(Math.min(17, selectedWeek + 1))}
              disabled={selectedWeek >= 17}
            >
              <Text style={styles.weekButtonText}>Next →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Standings Header */}
      {hasData && (
        <View style={styles.standingsHeader}>
          <View style={styles.rankContainer}>
            <Text style={styles.headerText}>Rank</Text>
          </View>
          <View style={styles.userContainer}>
            <Text style={styles.headerText}>Player</Text>
          </View>
          <View style={styles.statsContainer}>
            <Text style={styles.headerText}>Record</Text>
            <Text style={styles.headerText}>Points</Text>
            {viewMode === 'season' && <Text style={styles.headerText}>Win %</Text>}
          </View>
        </View>
      )}

      {/* Standings List */}
      <FlatList
        data={currentStandings as (WeeklyStanding | SeasonStanding)[]}
        renderItem={renderStanding}
        keyExtractor={(item) => item.user_id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true);
            loadStandings();
          }} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No Standings Yet</Text>
            <Text style={styles.emptySubtext}>
              Standings will appear after picks are graded.
            </Text>
          </View>
        }
        contentContainerStyle={!hasData ? styles.emptyContainer : undefined}
      />
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
  viewModeSelector: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
    marginHorizontal: 4,
  },
  selectedViewModeButton: {
    backgroundColor: '#007AFF',
  },
  viewModeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  selectedViewModeText: {
    color: '#fff',
  },
  weekSelector: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  selectorLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  weekControls: {
    flexDirection: 'row',
    gap: 12,
  },
  weekButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  weekButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  standingsHeader: {
    backgroundColor: '#f0f0f0',
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  standingRow: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
  },
  rank: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  userContainer: {
    flex: 1,
    paddingLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  weeksPlayed: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  statsContainer: {
    alignItems: 'flex-end',
    minWidth: 80,
  },
  record: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  points: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
    marginTop: 2,
  },
  percentage: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
});