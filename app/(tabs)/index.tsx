import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { supabase, type League } from '@/lib/supabase';
import { router } from 'expo-router';
import { testFrontendBackendIntegration } from '@/lib/test-integration';

type LeagueWithRole = League & { role: 'commish' | 'player' };

type WeekSummary = {
  totalPicks: number;
  possiblePicks: number;
  picksToMake: number;
  nextKickoff: Date | null;
};

export default function HomeScreen() {
  const [leagues, setLeagues] = useState<LeagueWithRole[]>([]);
  const [currentLeague, setCurrentLeague] = useState<LeagueWithRole | null>(null);
  const [weekSummary, setWeekSummary] = useState<WeekSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentSeason] = useState(2025);
  const [currentWeek] = useState(1);

  useEffect(() => {
    loadLeagues();
  }, []);

  useEffect(() => {
    if (currentLeague) {
      loadWeekSummary();
    }
  }, [currentLeague]);

  const loadLeagues = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get leagues where user is a member
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
        .eq('user_id', user.id);

      if (error) throw error;

      const formattedLeagues: LeagueWithRole[] = memberData?.map(member => ({
        ...(member.leagues as any),
        role: member.role as 'commish' | 'player'
      })) || [];

      setLeagues(formattedLeagues);
      
      // Set first league as current if none selected
      if (formattedLeagues.length > 0 && !currentLeague) {
        setCurrentLeague(formattedLeagues[0]);
      }
    } catch (error) {
      console.error('Error loading leagues:', error);
      Alert.alert('Error', 'Failed to load leagues');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadWeekSummary = async () => {
    if (!currentLeague) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's picks for current week
      const { data: picks, error: picksError } = await supabase
        .from('picks')
        .select('*')
        .eq('league_id', currentLeague.id)
        .eq('user_id', user.id)
        .eq('season', currentSeason)
        .eq('week', currentWeek);

      if (picksError) throw picksError;

      // Get upcoming games for countdown
      const { data: games, error: gamesError } = await supabase
        .from('games')
        .select('kickoff')
        .eq('season', currentSeason)
        .eq('week', currentWeek)
        .gte('kickoff', new Date().toISOString())
        .order('kickoff', { ascending: true })
        .limit(1);

      if (gamesError) throw gamesError;

      const nextKickoff = games?.[0]?.kickoff ? new Date(games[0].kickoff) : null;
      const pickLimit = currentLeague.pick_limit || 5;
      const totalPicks = picks?.length || 0;

      setWeekSummary({
        totalPicks,
        possiblePicks: pickLimit,
        picksToMake: Math.max(0, pickLimit - totalPicks),
        nextKickoff
      });
    } catch (error) {
      console.error('Error loading week summary:', error);
    }
  };

  const formatTimeUntil = (date: Date): string => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    
    if (diff <= 0) return 'Game time!';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (leagues.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>CFB Pick'em</Text>
        </View>
        
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Welcome!</Text>
          <Text style={styles.emptySubtext}>
            Create or join a league to start making picks
          </Text>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={() => router.push('/(tabs)/league')}
            >
              <Text style={styles.primaryButtonText}>Get Started</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={() => {
            setRefreshing(true);
            loadLeagues();
            if (currentLeague) loadWeekSummary();
          }} 
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Home</Text>
      </View>

      {/* Current League */}
      {currentLeague && (
        <View style={styles.section}>
          <View style={styles.leagueHeader}>
            <Text style={styles.leagueName}>{currentLeague.name}</Text>
            <View style={[styles.roleBadge, currentLeague.role === 'commish' && styles.commishBadge]}>
              <Text style={[styles.roleText, currentLeague.role === 'commish' && styles.commishText]}>
                {currentLeague.role === 'commish' ? 'Commissioner' : 'Player'}
              </Text>
            </View>
          </View>
          
          {leagues.length > 1 && (
            <TouchableOpacity 
              style={styles.switchButton}
              onPress={() => router.push('/(tabs)/league')}
            >
              <Text style={styles.switchButtonText}>Switch League</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Week Summary */}
      {weekSummary && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Week {currentWeek} Summary</Text>
          
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Picks Made</Text>
              <Text style={styles.summaryValue}>
                {weekSummary.totalPicks} / {weekSummary.possiblePicks}
              </Text>
            </View>
            
            {weekSummary.picksToMake > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Still Need</Text>
                <Text style={[styles.summaryValue, styles.warningText]}>
                  {weekSummary.picksToMake} picks
                </Text>
              </View>
            )}
            
            {weekSummary.nextKickoff && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Next Game</Text>
                <Text style={styles.summaryValue}>
                  {formatTimeUntil(weekSummary.nextKickoff)}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Quick Actions */}
      {currentLeague && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity 
              style={styles.quickActionCard}
              onPress={() => router.push(`/league/${currentLeague.id}/slate`)}
            >
              <Text style={styles.quickActionIcon}>📋</Text>
              <Text style={styles.quickActionTitle}>Make Picks</Text>
              <Text style={styles.quickActionSubtext}>View this week's slate</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.quickActionCard}
              onPress={() => router.push(`/league/${currentLeague.id}/my-picks`)}
            >
              <Text style={styles.quickActionIcon}>✅</Text>
              <Text style={styles.quickActionTitle}>My Picks</Text>
              <Text style={styles.quickActionSubtext}>View your selections</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.quickActionCard}
              onPress={() => router.push(`/league/${currentLeague.id}/standings`)}
            >
              <Text style={styles.quickActionIcon}>🏆</Text>
              <Text style={styles.quickActionTitle}>Standings</Text>
              <Text style={styles.quickActionSubtext}>See league rankings</Text>
            </TouchableOpacity>
            
            {currentLeague.role === 'commish' && (
              <TouchableOpacity 
                style={styles.quickActionCard}
                onPress={() => router.push('/(tabs)/admin')}
              >
                <Text style={styles.quickActionIcon}>⚙️</Text>
                <Text style={styles.quickActionTitle}>Admin</Text>
                <Text style={styles.quickActionSubtext}>Manage league</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* My Leagues */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Leagues</Text>
        
        {leagues.map((league) => (
          <View key={league.id} style={styles.leagueCardContainer}>
            <TouchableOpacity 
              style={[
                styles.leagueCard,
                currentLeague?.id === league.id && styles.currentLeagueCard
              ]}
              onPress={() => {
                setCurrentLeague(league);
                router.push(`/league/${league.id}/standings`);
              }}
            >
              <View style={styles.leagueCardHeader}>
                <Text style={styles.leagueCardName}>{league.name}</Text>
                <View style={[styles.roleBadge, league.role === 'commish' && styles.commishBadge]}>
                  <Text style={[styles.roleText, league.role === 'commish' && styles.commishText]}>
                    {league.role === 'commish' ? 'Commissioner' : 'Player'}
                  </Text>
                </View>
              </View>
              <Text style={styles.leagueCardSubtext}>
                Tap to view standings • {league.pick_limit || 5} picks per week
              </Text>
              {currentLeague?.id === league.id && (
                <Text style={styles.currentLeagueIndicator}>📍 Current League</Text>
              )}
            </TouchableOpacity>
          </View>
        ))}
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => router.push('/(tabs)/league')}
        >
          <Text style={styles.actionButtonText}>+ Create or Join League</Text>
          <Text style={styles.actionButtonSubtext}>Start a new league or join with invite code</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
    fontSize: 24,
    fontWeight: 'bold',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#000',
  },
  leagueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  leagueName: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    color: '#000',
  },
  roleBadge: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  commishBadge: {
    backgroundColor: '#007AFF',
  },
  roleText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  commishText: {
    color: '#fff',
  },
  switchButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  switchButtonText: {
    color: '#007AFF',
    fontSize: 14,
  },
  summaryCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#666',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  warningText: {
    color: '#ff6b6b',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    width: '47%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  quickActionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
    textAlign: 'center',
  },
  quickActionSubtext: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  actionButton: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  actionButtonSubtext: {
    fontSize: 14,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  buttonContainer: {
    paddingHorizontal: 32,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  leagueCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  currentLeagueCard: {
    backgroundColor: '#e3f2fd',
    borderColor: '#90caf9',
  },
  leagueCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  leagueCardName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    flex: 1,
  },
  leagueCardSubtext: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  currentLeagueIndicator: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
    marginTop: 4,
  },
  leagueCardContainer: {
    marginBottom: 16,
  },
});
