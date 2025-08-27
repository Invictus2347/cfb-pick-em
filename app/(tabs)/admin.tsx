import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  ScrollView,
  Switch,
} from 'react-native';
import { supabase, type League } from '@/lib/supabase';

export default function AdminScreen() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(false);
  const [season, setSeason] = useState('2024');
  const [week, setWeek] = useState('1');
  
  // League settings state
  const [pickLimit, setPickLimit] = useState(5);
  const [pushPoints, setPushPoints] = useState(0.5);
  const [lockMode, setLockMode] = useState<'per_game' | 'global'>('per_game');
  const [globalLockAt, setGlobalLockAt] = useState('');

  useEffect(() => {
    loadCommissionerLeagues();
  }, []);

  useEffect(() => {
    if (selectedLeague) {
      // Update form with selected league settings
      setPickLimit(selectedLeague.pick_limit || 5);
      setPushPoints(selectedLeague.push_points || 0.5);
      // Default to per_game lock mode for now
      setLockMode('per_game');
      setGlobalLockAt('');
    }
  }, [selectedLeague]);

  const loadCommissionerLeagues = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get leagues where user is commissioner
      const { data: memberData, error } = await supabase
        .from('league_members')
        .select(`
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
        .eq('user_id', user.id)
        .eq('role', 'commish');

      if (error) throw error;

      const commissionerLeagues = memberData?.map(member => member.leagues as any) || [];
      setLeagues(commissionerLeagues);
      
      if (commissionerLeagues.length > 0) {
        setSelectedLeague(commissionerLeagues[0]);
      }
    } catch (error) {
      console.error('Error loading commissioner leagues:', error);
      Alert.alert('Error', 'Failed to load leagues');
    }
  };

  const publishWeek = async () => {
    if (!selectedLeague) {
      Alert.alert('Error', 'Please select a league');
      return;
    }

    const seasonNum = parseInt(season);
    const weekNum = parseInt(week);

    if (isNaN(seasonNum) || isNaN(weekNum) || weekNum < 1 || weekNum > 17) {
      Alert.alert('Error', 'Please enter valid season and week numbers');
      return;
    }

    try {
      setLoading(true);
      
      // Call the publish_week edge function
      const { data, error } = await supabase.functions.invoke('publish_week', {
        body: {
          league_id: selectedLeague.id,
          season: seasonNum,
          week: weekNum
        }
      });

      if (error) throw error;

      Alert.alert(
        'Success', 
        `Week ${week} slate published for ${selectedLeague.name}!\n\nGames: ${data?.games_count || 0}\nLines: ${data?.lines_count || 0}`
      );
    } catch (error) {
      console.error('Error publishing week:', error);
      Alert.alert('Error', 'Failed to publish week. Check your internet connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateLeagueSettings = async () => {
    if (!selectedLeague) {
      Alert.alert('Error', 'Please select a league');
      return;
    }

    try {
      setLoading(true);
      
      const newSettings = {
        pick_limit: pickLimit,
        push_points: pushPoints,
        lock_mode: lockMode,
        ...(lockMode === 'global' && globalLockAt ? { global_lock_at: globalLockAt } : {})
      };

      const { error } = await supabase
        .from('leagues')
        .update({
          pick_limit: pickLimit,
          push_points: pushPoints
        })
        .eq('id', selectedLeague.id);

      if (error) throw error;

      Alert.alert('Success', 'League settings updated!');
      
      // Update local state
      setSelectedLeague({
        ...selectedLeague,
        pick_limit: pickLimit,
        push_points: pushPoints
      });
      
      // Refresh leagues
      loadCommissionerLeagues();
    } catch (error) {
      console.error('Error updating league settings:', error);
      Alert.alert('Error', 'Failed to update league settings');
    } finally {
      setLoading(false);
    }
  };

  if (leagues.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No Commissioner Access</Text>
          <Text style={styles.emptySubtext}>
            You are not a commissioner of any leagues. Create a league from the Home tab to access admin features.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>League Admin</Text>
      </View>

      {/* League Selector */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Select League</Text>
        {leagues.map((league) => (
          <TouchableOpacity
            key={league.id}
            style={[
              styles.leagueOption,
              selectedLeague?.id === league.id && styles.selectedLeagueOption
            ]}
            onPress={() => setSelectedLeague(league)}
          >
            <Text style={[
              styles.leagueOptionText,
              selectedLeague?.id === league.id && styles.selectedLeagueOptionText
            ]}>
              {league.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {selectedLeague && (
        <>
          {/* Publish Slate Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Publish Weekly Slate</Text>
            <Text style={styles.sectionDescription}>
              Snapshot games and spreads for a specific week
            </Text>
            
            <View style={styles.inputRow}>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Season</Text>
                <TextInput
                  style={styles.input}
                  value={season}
                  onChangeText={setSeason}
                  placeholder="2024"
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Week</Text>
                <TextInput
                  style={styles.input}
                  value={week}
                  onChangeText={setWeek}
                  placeholder="1"
                  keyboardType="numeric"
                />
              </View>
            </View>
            
            <TouchableOpacity 
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={publishWeek}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? 'Publishing...' : 'Publish Slate'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* League Settings Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>League Settings</Text>
            
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Pick Limit per Week</Text>
              <TextInput
                style={styles.numberInput}
                value={pickLimit.toString()}
                onChangeText={(text) => setPickLimit(parseInt(text) || 0)}
                keyboardType="numeric"
                placeholder="5"
              />
            </View>

            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Push Points (0, 0.5, or 1)</Text>
              <TextInput
                style={styles.numberInput}
                value={pushPoints.toString()}
                onChangeText={(text) => setPushPoints(parseFloat(text) || 0)}
                keyboardType="decimal-pad"
                placeholder="0.5"
              />
            </View>

            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Lock Mode</Text>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Per Game</Text>
                <Switch
                  value={lockMode === 'global'}
                  onValueChange={(value) => setLockMode(value ? 'global' : 'per_game')}
                />
                <Text style={styles.switchLabel}>Global</Text>
              </View>
            </View>

            {lockMode === 'global' && (
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Global Lock Time (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={globalLockAt}
                  onChangeText={setGlobalLockAt}
                  placeholder="e.g., Saturday 12:00 PM"
                />
              </View>
            )}
            
            <TouchableOpacity 
              style={[styles.secondaryButton, loading && styles.disabledButton]}
              onPress={updateLeagueSettings}
              disabled={loading}
            >
              <Text style={styles.secondaryButtonText}>
                {loading ? 'Updating...' : 'Update Settings'}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
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
    marginVertical: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  leagueOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 8,
  },
  selectedLeagueOption: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  leagueOptionText: {
    fontSize: 16,
    color: '#000',
  },
  selectedLeagueOptionText: {
    color: '#fff',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  inputHalf: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  numberInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    width: 80,
  },
  settingItem: {
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  switchLabel: {
    fontSize: 16,
    color: '#333',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
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