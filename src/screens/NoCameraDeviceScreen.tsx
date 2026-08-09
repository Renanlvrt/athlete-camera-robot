import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

/**
 * NoCameraDeviceScreen
 *
 * Single responsibility: tell the user no usable camera device was found
 * (e.g. running in a simulator, or on hardware without a back camera).
 */
export function NoCameraDeviceScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>No camera device found.</Text>
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
