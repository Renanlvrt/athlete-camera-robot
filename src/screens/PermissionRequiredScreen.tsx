import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

/**
 * PermissionRequiredScreen
 *
 * Single responsibility: tell the user we are waiting on camera permission.
 * Renders no logic, requests nothing — permission is requested by
 * src/hooks/useCameraSetup.ts. This component only displays that state.
 */
export function PermissionRequiredScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Requesting camera permission…</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: colors.text,
  },
});
