import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  Modal,
  FlatList,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import type { League, LeagueMember } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { testFrontendBackendIntegration } from '@/lib/test-integration';

type LeagueWithRole = League & { role: 'commish' | 'player' };

export default function LeagueScreen() {
  const [leagues, setLeagues] = useState<LeagueWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const { signOut: authSignOut, user, userEmail } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState<LeagueWithRole | null>(null);

  // Create league form
  const [leagueName, setLeagueName] = useState('');
  const [pickLimit, setPickLimit] = useState(5);
  const [pushPoints, setPushPoints] = useState(0.5);

  // Join league form
  const [inviteCode, setInviteCode] = useState('');

  useEffect(() => {
    fetchLeagues();
  }, []);

  const fetchLeagues = async () => {
    try {
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
    } catch (error) {
      console.error('Error fetching leagues:', error);
      setLeagues([]);
    } finally {
      setLoading(false);
    }
  };

  const createLeague = async () => {
    if (!leagueName.trim()) {
      Alert.alert('Error', 'Please enter a league name');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Generate invite code
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();

      const { data, error } = await supabase
        .from('leagues')
        .insert({
          name: leagueName.trim(),
          invite_code: code,
          created_by: user.id,
          pick_limit: pickLimit,
          push_points: pushPoints,
        })
        .select()
        .single();

      if (error) throw error;

      // Add creator as commissioner
      const { error: memberError } = await supabase
        .from('league_members')
        .insert({
          league_id: data.id,
          user_id: user.id,
          role: 'commish',
        });

      if (memberError) throw memberError;

      setShowCreateModal(false);
      setLeagueName('');
      fetchLeagues();
      Alert.alert('Success', `League created! Invite code: ${code}`);
    } catch (error) {
      console.error('Error creating league:', error);
      Alert.alert('Error', `Failed to create league: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const joinLeague = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Error', 'Please enter an invite code');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Find league by invite code
      const { data: league, error: leagueError } = await supabase
        .from('leagues')
        .select('*')
        .eq('invite_code', inviteCode.trim().toUpperCase())
        .single();

      if (leagueError || !league) {
        Alert.alert('Error', 'Invalid invite code');
        return;
      }

      // Check if already a member
      const { data: existing } = await supabase
        .from('league_members')
        .select('*')
        .eq('league_id', league.id)
        .eq('user_id', user.id)
        .single();

      if (existing) {
        Alert.alert('Error', 'You are already a member of this league');
        return;
      }

      // Join league
      const { error } = await supabase
        .from('league_members')
        .insert({
          league_id: league.id,
          user_id: user.id,
          role: 'player',
        });

      if (error) throw error;

      setShowJoinModal(false);
      setInviteCode('');
      fetchLeagues();
      Alert.alert('Success', `Joined "${league.name}"!`);
    } catch (error) {
      console.error('Error joining league:', error);
      Alert.alert('Error', 'Failed to join league');
    }
  };

  const updateLeagueSettings = async () => {
    if (!selectedLeague) return;

    try {
      const { error } = await supabase
        .from('leagues')
        .update({
          pick_limit: pickLimit,
          push_points: pushPoints,
        })
        .eq('id', selectedLeague.id);

      if (error) throw error;

      setShowSettingsModal(false);
      fetchLeagues();
      Alert.alert('Success', 'League settings updated!');
    } catch (error) {
      console.error('Error updating league:', error);
      Alert.alert('Error', 'Failed to update league settings');
    }
  };

  const navigateToLeague = (league: LeagueWithRole) => {
    router.push(`/league/${league.id}/standings`);
  };

  const openCommissionerTools = (league: LeagueWithRole) => {
    setSelectedLeague(league);
    setPickLimit(league.pick_limit);
    setPushPoints(league.push_points);
    setShowSettingsModal(true);
  };

  const signOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              authSignOut();
              Alert.alert('Signed Out', 'You have been signed out successfully');
            } catch (error) {
              console.error('Sign out exception:', error);
              Alert.alert('Error', 'Failed to sign out');
            }
          },
        },
      ]
    );
  };

  const renderLeague = ({ item }: { item: LeagueWithRole }) => (
    <View style={styles.leagueCard}>
      <View style={styles.leagueHeader}>
        <Text style={styles.leagueName}>{item.name}</Text>
        <View style={[styles.roleBadge, item.role === 'commish' && styles.commishBadge]}>
          <Text style={[styles.roleText, item.role === 'commish' && styles.commishText]}>
            {item.role === 'commish' ? 'Commissioner' : 'Player'}
          </Text>
        </View>
      </View>
      
      <Text style={styles.leagueDetail}>
        Pick Limit: {item.pick_limit} per week
      </Text>
      <Text style={styles.leagueDetail}>
        Push Scoring: {item.push_points} points
      </Text>
      
      {item.role === 'commish' && (
        <View style={styles.inviteCodeSection}>
          <Text style={styles.inviteCodeLabel}>League Invite Code:</Text>
          <Text style={styles.inviteCodeText}>{item.invite_code}</Text>
        </View>
      )}
      
      <View style={styles.leagueActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => router.push(`/league/${item.id}/standings`)}
        >
          <Text style={styles.actionButtonText}>🏆 Standings</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => router.push(`/league/${item.id}/slate`)}
        >
          <Text style={styles.actionButtonText}>📋 Slate</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => router.push(`/league/${item.id}/my-picks`)}
        >
          <Text style={styles.actionButtonText}>✅ My Picks</Text>
        </TouchableOpacity>
      </View>

      {item.role === 'commish' && (
        <View style={styles.commissionerActions}>
          <TouchableOpacity 
            style={styles.commishButton}
            onPress={() => openCommissionerTools(item)}
          >
            <Text style={styles.commishButtonText}>⚙️ League Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.commishButton}
            onPress={() => {
              Alert.alert('Member Management', 'View and manage league members (coming soon!)');
            }}
          >
            <Text style={styles.commishButtonText}>👥 Manage Members</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Leagues</Text>

      {leagues.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No leagues yet</Text>
          <Text style={styles.emptySubtext}>
            Create or join a league to get started
          </Text>
        </View>
      ) : (
        <FlatList
          data={leagues}
          renderItem={renderLeague}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
        />
      )}

      {/* Action Buttons */}
      <View style={styles.actionSection}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={() => setShowCreateModal(true)}
        >
          <Text style={styles.buttonText}>Create League</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => setShowJoinModal(true)}
        >
          <Text style={styles.buttonText}>Join League</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.dangerButton]}
          onPress={signOut}
        >
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Test Integration Button (remove for production) */}
        <TouchableOpacity
          style={[styles.button, styles.testButton]}
          onPress={async () => {
            console.log('🧪 Running integration tests...');
            await testFrontendBackendIntegration();
          }}
        >
          <Text style={styles.buttonText}>🧪 Test Integration</Text>
        </TouchableOpacity>
      </View>

      {/* Create League Modal */}
      <Modal visible={showCreateModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Create League</Text>
          
          <TextInput
            style={styles.input}
            placeholder="League Name"
            value={leagueName}
            onChangeText={setLeagueName}
          />

          <Text style={styles.label}>Pick Limit per Week</Text>
          <View style={styles.pickerContainer}>
            {[3, 5, 8, 10, 12, 15, 20].map((limit) => (
              <TouchableOpacity
                key={limit}
                style={[
                  styles.pickerOption,
                  pickLimit === limit && styles.pickerOptionSelected,
                ]}
                onPress={() => setPickLimit(limit)}
              >
                <Text
                  style={[
                    styles.pickerText,
                    pickLimit === limit && styles.pickerTextSelected,
                  ]}
                >
                  {limit}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Push Scoring</Text>
          <View style={styles.pickerContainer}>
            {[0, 0.5, 1].map((points) => (
              <TouchableOpacity
                key={points}
                style={[
                  styles.pickerOption,
                  pushPoints === points && styles.pickerOptionSelected,
                ]}
                onPress={() => setPushPoints(points)}
              >
                <Text
                  style={[
                    styles.pickerText,
                    pushPoints === points && styles.pickerTextSelected,
                  ]}
                >
                  {points}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setShowCreateModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.primaryButton]}
              onPress={createLeague}
            >
              <Text style={styles.buttonText}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Join League Modal */}
      <Modal visible={showJoinModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Join League</Text>
          
          <TextInput
            style={styles.input}
            placeholder="Invite Code (6 characters)"
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="characters"
            maxLength={6}
          />

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setShowJoinModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.primaryButton]}
              onPress={joinLeague}
            >
              <Text style={styles.buttonText}>Join</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* League Settings Modal */}
      <Modal visible={showSettingsModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>League Settings</Text>
          <Text style={styles.modalSubtitle}>{selectedLeague?.name}</Text>
          
          <Text style={styles.label}>Pick Limit per Week</Text>
          <View style={styles.pickerContainer}>
            {[3, 5, 8, 10, 12, 15, 20].map((limit) => (
              <TouchableOpacity
                key={limit}
                style={[
                  styles.pickerOption,
                  pickLimit === limit && styles.pickerOptionSelected,
                ]}
                onPress={() => setPickLimit(limit)}
              >
                <Text
                  style={[
                    styles.pickerText,
                    pickLimit === limit && styles.pickerTextSelected,
                  ]}
                >
                  {limit}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Push Scoring</Text>
          <View style={styles.pickerContainer}>
            {[0, 0.5, 1].map((points) => (
              <TouchableOpacity
                key={points}
                style={[
                  styles.pickerOption,
                  pushPoints === points && styles.pickerOptionSelected,
                ]}
                onPress={() => setPushPoints(points)}
              >
                <Text
                  style={[
                    styles.pickerText,
                    pushPoints === points && styles.pickerTextSelected,
                  ]}
                >
                  {points}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setShowSettingsModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.primaryButton]}
              onPress={updateLeagueSettings}
            >
              <Text style={styles.buttonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  listContainer: {
    padding: 16,
  },
  leagueCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  leagueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  leagueName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    flex: 1,
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
  leagueDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  inviteCodeSection: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  inviteCodeLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  inviteCodeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
    letterSpacing: 1,
  },
  leagueActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  commissionerActions: {
    marginTop: 12,
    gap: 8,
  },
  commishButton: {
    backgroundColor: '#e3f2fd',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#90caf9',
  },
  commishButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  actionSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  button: {
    backgroundColor: '#007bff',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: '#007bff',
  },
  dangerButton: {
    backgroundColor: '#dc3545',
  },
  testButton: {
    backgroundColor: '#6c757d',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fff',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  pickerOption: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    margin: 4,
    minWidth: 50,
    alignItems: 'center',
  },
  pickerOptionSelected: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  pickerText: {
    fontSize: 16,
    color: '#333',
  },
  pickerTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  cancelButton: {
    backgroundColor: '#6c757d',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
