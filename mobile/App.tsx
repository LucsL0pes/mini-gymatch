import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import Onboarding from './src/api/screens/Onboarding';
import Swipe from './src/api/screens/Swipe';
import Matches from './src/api/screens/Matches';
import ProofUpload from './src/api/screens/ProofUpload';

export type RootStackParamList = {
  Onboarding: undefined;
  Swipe: undefined;
  Matches: undefined;
  ProofUpload: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator id={undefined} initialRouteName="Onboarding">
          <Stack.Screen name="Onboarding" component={Onboarding} />
          <Stack.Screen name="Swipe" component={Swipe} />
          <Stack.Screen name="Matches" component={Matches} />
          <Stack.Screen name="ProofUpload" component={ProofUpload} />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
