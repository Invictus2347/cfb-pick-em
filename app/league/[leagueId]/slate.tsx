import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase, type League, type Game, type LeagueSlateLine, type Pick } from '@/lib/supabase';
import GameCard from '@/components/GameCard';

type LeagueWithRole = League & { role: 'commish' | 'player' };

type GameWithLine = {
  game: Game;
  line: LeagueSlateLine;
  existingPick?: Pick;
};

export default function LeagueSlateScreen() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();
  const [league, setLeague] = useState<LeagueWithRole | null>(null);
  const [gamesWithLines, setGamesWithLines] = useState<GameWithLine[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [tempPicks, setTempPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentSeason] = useState(2025);
  const [currentWeek, setCurrentWeek] = useState(1);

  useEffect(() => {
    if (leagueId) {
      loadLeague();
      loadSlateAndPicks();
    }
  }, [leagueId, currentWeek]);

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
    }
  };

  const loadSlateAndPicks = async () => {
    if (!leagueId) return;

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load slate lines with games
      const { data: slateData, error: slateError } = await supabase
        .from('league_slate_lines')
        .select(`
          *,
          games:game_id (
            id,
            season,
            week,
            home,
            away,
            kickoff,
            status
          )
        `)
        .eq('league_id', leagueId)
        .eq('season', currentSeason)
        .eq('week', currentWeek);

      if (slateError) throw slateError;

      // Load existing picks for this user
      const { data: picksData, error: picksError } = await supabase
        .from('picks')
        .select('*')
        .eq('league_id', leagueId)
        .eq('user_id', user.id)
        .eq('season', currentSeason)
        .eq('week', currentWeek);

      if (picksError) throw picksError;

      // Combine slate and picks data
      const gamesWithLines: GameWithLine[] = (slateData || [])
        .filter(slate => slate.games)
        .map(slate => {
          const existingPick = (picksData || []).find(pick => pick.game_id === slate.game_id);
          return {
            game: slate.games as Game,
            line: slate as LeagueSlateLine,
            existingPick
          };
        });

      setGamesWithLines(gamesWithLines);
      setPicks(picksData || []);
      setTempPicks([]); // Clear temp picks when reloading

    } catch (error) {
      console.error('Error loading slate:', error);
      Alert.alert('Error', 'Failed to load slate');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handlePickSide = async (gameId: string, side: 'HOME' | 'AWAY', lineValue: number) => {
    if (!league) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const pickLimit = league.pick_limit || 5;
      const existingTempPickForGame = tempPicks.find(pick => pick.game_id === gameId);
      const existingSubmittedPick = picks.find(pick => pick.game_id === gameId);
      const currentTempPicksCount = tempPicks.length;

      // If there's already a submitted pick, don't allow changes
      if (existingSubmittedPick) {
        Alert.alert('Pick Already Submitted', 'You have already submitted a pick for this game. Picks cannot be changed after submission.');
        return;
      }

      // Check if we can add more picks
      if (!existingTempPickForGame && currentTempPicksCount >= pickLimit) {
        Alert.alert('Pick Limit Reached', `You can only make ${pickLimit} picks per week.`);
        return;
      }

      // Calculate unlock_at (Saturday 12:00 PM ET of the current week)
      const currentDate = new Date();
      const currentWeekStart = new Date(currentDate);
      currentWeekStart.setDate(currentDate.getDate() - currentDate.getDay()); // Start of week (Sunday)
      const saturdayUnlock = new Date(currentWeekStart);
      saturdayUnlock.setDate(currentWeekStart.getDate() + 6); // Saturday
      saturdayUnlock.setHours(12, 0, 0, 0); // 12:00 PM
      
      // Convert to ET (UTC-5 or UTC-4 depending on DST)
      saturdayUnlock.setHours(saturdayUnlock.getHours() + 5);

      // Create temporary pick
      const newTempPick: Pick = {
        league_id: league.id,
        user_id: user.id,
        season: currentSeason,
        week: currentWeek,
        game_id: gameId,
        side: side,
        line_value: lineValue,
        unlock_at: saturdayUnlock.toISOString(),
        locked: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Update temporary picks
      const updatedTempPicks = existingTempPickForGame 
        ? tempPicks.map(p => p.game_id === gameId ? newTempPick : p)
        : [...tempPicks, newTempPick];
      
      setTempPicks(updatedTempPicks);
      
      // Update games with new temporary pick
      const updatedGames = gamesWithLines.map(gwl => 
        gwl.game.id === gameId 
          ? { ...gwl, existingPick: newTempPick }
          : gwl
      );
      setGamesWithLines(updatedGames);

      // Show pick confirmation
      Alert.alert(
        'Pick Selected', 
        `${side} ${lineValue > 0 ? '+' : ''}${lineValue}\n\nPicks: ${updatedTempPicks.length}/${pickLimit}`,
        [{ text: 'OK' }]
      );

      // Check if all picks are made
      if (updatedTempPicks.length === pickLimit) {
        setTimeout(() => {
          Alert.alert(
            'All Picks Selected!',
            `You've made all ${pickLimit} picks. Ready to submit?`,
            [
              { text: 'Review Picks', style: 'cancel' },
              { text: 'Submit Picks', onPress: submitAllPicks }
            ]
          );
        }, 500);
      }

    } catch (error) {
      console.error('Error selecting pick:', error);
      Alert.alert('Error', 'Failed to select pick');
    }
  };

  const submitAllPicks = async () => {
    if (!league || tempPicks.length === 0) return;

    try {
      setSubmitting(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Submit all temporary picks to the database
      const { error } = await supabase
        .from('picks')
        .upsert(tempPicks.map(pick => ({
          league_id: pick.league_id,
          user_id: pick.user_id,
          season: pick.season,
          week: pick.week,
          game_id: pick.game_id,
          side: pick.side,
          line_value: pick.line_value,
          unlock_at: pick.unlock_at,
          locked: false
        })), {
          onConflict: 'league_id,user_id,season,week,game_id'
        });

      if (error) throw error;

      // Clear temporary picks and reload data
      setTempPicks([]);
      await loadSlateAndPicks();
      
      Alert.alert(
        'Picks Submitted!',
        `Successfully submitted ${tempPicks.length} picks for ${league.name}.\n\nYou can view your picks in the MY PICKS tab.`,
        [
          { text: 'View My Picks', onPress: () => {
            // Navigate to my picks tab
          }},
          { text: 'OK' }
        ]
      );

    } catch (error) {
      console.error('Error submitting picks:', error);
      Alert.alert('Error', 'Failed to submit picks. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderGame = ({ item }: { item: GameWithLine }) => (
    <GameCard
      gameWithLine={item}
      onPickSide={handlePickSide}
      disabled={loading || !!item.existingPick}
    />
  );

  const submittedPicksCount = picks.length;
  const tempPicksCount = tempPicks.length;
  const pickLimit = league?.pick_limit || 5;
  const hasSubmittedPicks = submittedPicksCount > 0;
  const canSubmit = tempPicksCount === pickLimit;

  return (
    <View style={styles.container}>
      {/* Header with League and Week Navigation */}
      <View style={styles.header}>
        <View style={styles.leagueHeader}>
          <Text style={styles.leagueName}>{league?.name || 'League'}</Text>
          <Text style={styles.weekTitle}>Week {currentWeek} Slate</Text>
        </View>
        
        <View style={styles.weekNavigation}>
          <TouchableOpacity 
            style={styles.weekNavButton}
            onPress={() => setCurrentWeek(Math.max(1, currentWeek - 1))}
            disabled={currentWeek <= 1}
          >
            <Text style={[styles.weekNavText, currentWeek <= 1 && styles.disabledText]}>← Week {currentWeek - 1}</Text>
          </TouchableOpacity>
          
          <View style={styles.currentWeekContainer}>
            <Text style={styles.pickStatus}>
              {hasSubmittedPicks ? `${submittedPicksCount} submitted` : `${tempPicksCount}/${pickLimit} selected`}
            </Text>
            {hasSubmittedPicks && (
              <Text style={styles.submittedIndicator}>✅ Picks Submitted</Text>
            )}
          </View>
          
          <TouchableOpacity 
            style={styles.weekNavButton}
            onPress={() => setCurrentWeek(Math.min(15, currentWeek + 1))}
            disabled={currentWeek >= 15}
          >
            <Text style={[styles.weekNavText, currentWeek >= 15 && styles.disabledText]}>Week {currentWeek + 1} →</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Games List */}
      <FlatList
        data={gamesWithLines}
        renderItem={renderGame}
        keyExtractor={(item) => item.game.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true);
            loadSlateAndPicks();
          }} />
        }
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No Games Available</Text>
              <Text style={styles.emptySubtext}>
                Check back later or contact your commissioner.
              </Text>
            </View>
          )
        }
        contentContainerStyle={gamesWithLines.length === 0 ? styles.emptyContainer : undefined}
      />

      {/* Pick Summary and Submission */}
      <View style={styles.pickSummary}>
        {hasSubmittedPicks ? (
          <View style={styles.submittedSection}>
            <Text style={styles.submittedText}>✅ Picks Submitted for {league?.name}</Text>
            <Text style={styles.submittedSubtext}>{submittedPicksCount} picks locked for Week {currentWeek}</Text>
            <Text style={styles.submittedNote}>View your picks in the MY PICKS tab</Text>
          </View>
        ) : (
          <View style={styles.selectionSection}>
            <Text style={styles.pickSummaryText}>
              {tempPicksCount} of {pickLimit} picks selected
            </Text>
            
            {tempPicksCount > 0 && tempPicksCount < pickLimit && (
              <Text style={styles.needMoreText}>
                Need {pickLimit - tempPicksCount} more picks to submit
              </Text>
            )}
            
            {canSubmit && (
              <TouchableOpacity 
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={submitAllPicks}
                disabled={submitting}
              >
                <Text style={styles.submitButtonText}>
                  {submitting ? 'Submitting...' : `Submit ${tempPicksCount} Picks`}
                </Text>
              </TouchableOpacity>
            )}
            
            {tempPicksCount > 0 && !canSubmit && (
              <TouchableOpacity 
                style={styles.clearButton}
                onPress={() => {
                  Alert.alert(
                    'Clear Selections',
                    'Are you sure you want to clear all selected picks?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Clear', style: 'destructive', onPress: () => {
                        setTempPicks([]);
                        loadSlateAndPicks();
                      }}
                    ]
                  );
                }}
              >
                <Text style={styles.clearButtonText}>Clear Selections</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
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
  leagueHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  leagueName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  weekTitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  weekNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weekNavButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  weekNavText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  disabledText: {
    color: '#ccc',
  },
  currentWeekContainer: {
    alignItems: 'center',
  },
  pickStatus: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  submittedIndicator: {
    fontSize: 12,
    color: '#28a745',
    marginTop: 2,
    fontWeight: '500',
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
  pickSummary: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  submittedSection: {
    alignItems: 'center',
    padding: 16,
  },
  submittedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#28a745',
    textAlign: 'center',
    marginBottom: 4,
  },
  submittedSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  submittedNote: {
    fontSize: 12,
    color: '#007AFF',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  selectionSection: {
    alignItems: 'center',
    padding: 16,
  },
  pickSummaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  needMoreText: {
    fontSize: 14,
    color: '#ffc107',
    marginTop: 4,
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#28a745',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 12,
  },
  submitButtonDisabled: {
    backgroundColor: '#6c757d',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  clearButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginTop: 8,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});