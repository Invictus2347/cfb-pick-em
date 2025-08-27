import { supabase } from './supabase';

export async function testFrontendBackendIntegration() {
  console.log('🧪 Testing Frontend-Backend Integration...');
  
  const results = {
    authentication: false,
    leagues: false,
    slate: false,
    picks: false,
    standings: false,
    validation: false,
    commissioner: false
  };

  try {
    // Test 1: Authentication
    console.log('1. Testing Authentication...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.error('❌ Authentication failed:', authError);
    } else if (user) {
      console.log('✅ Authentication working - User:', user.email);
      results.authentication = true;
    } else {
      console.log('⚠️ No authenticated user (expected for sign-in flow)');
    }

    // Test 2: League Members Query (used in Home and League screens)
    console.log('2. Testing League Members Query...');
    const { data: leagues, error: leaguesError } = await supabase
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
      .eq('user_id', user?.id || 'test-user-id');

    if (leaguesError) {
      console.error('❌ League members query failed:', leaguesError);
    } else {
      console.log('✅ League members query working - Found leagues:', leagues?.length || 0);
      results.leagues = true;
    }

    // Test 3: Slate Query (used in Slate screen)
    console.log('3. Testing Slate Query...');
    if (leagues && leagues.length > 0) {
      const leagueId = leagues[0].leagues.id;
      const { data: slate, error: slateError } = await supabase
        .from('league_slate_lines')
        .select(`
          *,
          games (
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
        .eq('season', 2025)
        .eq('week', 1)
        .order('games(kickoff)', { ascending: true })
        .limit(5);

      if (slateError) {
        console.error('❌ Slate query failed:', slateError);
      } else {
        console.log('✅ Slate query working - Found games:', slate?.length || 0);
        results.slate = true;
      }
    }

    // Test 4: Picks Query (used in Picks screen)
    console.log('4. Testing Picks Query...');
    if (leagues && leagues.length > 0) {
      const leagueId = leagues[0].leagues.id;
      const { data: picks, error: picksError } = await supabase
        .from('picks')
        .select(`
          *,
          games:game_id (
            home,
            away,
            kickoff,
            status
          ),
          leagues:league_id (
            name
          )
        `)
        .eq('league_id', leagueId)
        .eq('user_id', user?.id || 'test-user-id')
        .eq('season', 2025)
        .eq('week', 1);

      if (picksError) {
        console.error('❌ Picks query failed:', picksError);
      } else {
        console.log('✅ Picks query working - Found picks:', picks?.length || 0);
        results.picks = true;
      }
    }

    // Test 5: Standings Query (used in Standings screen)
    console.log('5. Testing Standings Query...');
    if (leagues && leagues.length > 0) {
      const leagueId = leagues[0].leagues.id;
      const { data: standings, error: standingsError } = await supabase
        .from('league_members')
        .select(`
          user_id,
          role,
          users:user_id (
            email
          )
        `)
        .eq('league_id', leagueId);

      if (standingsError) {
        console.error('❌ Standings query failed:', standingsError);
      } else {
        console.log('✅ Standings query working - Found members:', standings?.length || 0);
        results.standings = true;
      }
    }

    // Test 6: Pick Validation (backend validation)
    console.log('6. Testing Pick Validation...');
    if (leagues && leagues.length > 0) {
      const leagueId = leagues[0].leagues.id;
      const { error: validationError } = await supabase
        .from('picks')
        .insert({
          league_id: leagueId,
          user_id: user?.id || 'test-user-id',
          season: 2025,
          week: 1,
          game_id: 401752793,
          side: 'HOME',
          line_value: 0,
          locked: false,
          unlock_at: new Date().toISOString()
        });

      if (validationError && validationError.message.includes('Lines not yet available')) {
        console.log('✅ Pick validation working - Correctly preventing picks when lines unavailable');
        results.validation = true;
      } else if (validationError) {
        console.error('❌ Pick validation failed:', validationError);
      } else {
        console.log('⚠️ Pick validation - No validation error (unexpected)');
      }
    }

    // Test 7: Commissioner Access
    console.log('7. Testing Commissioner Access...');
    if (leagues && leagues.length > 0) {
      const isCommish = leagues.some(l => l.role === 'commish');
      if (isCommish) {
        console.log('✅ Commissioner access working - User is commissioner');
        results.commissioner = true;
      } else {
        console.log('⚠️ Commissioner access - User is not commissioner');
      }
    }

  } catch (error) {
    console.error('❌ Integration test failed:', error);
  }

  // Summary
  console.log('\n📊 Integration Test Results:');
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
  });

  const allPassed = Object.values(results).every(Boolean);
  console.log(`\n${allPassed ? '🎉' : '⚠️'} Overall: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);

  return results;
}
