import { View, Image, Dimensions } from 'react-native';
import { colors, radii, spacing } from '../theme';

const ASPECT_RATIO = 4179 / 988;
const WIDTH = Math.min(Dimensions.get('window').width * 0.64, 260);
const HEIGHT = WIDTH / ASPECT_RATIO;

interface Props {
  style?: object;
}

export function SomnaraLogo({ style }: Props) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.background.primary,
          borderRadius: radii.lg,
          paddingHorizontal: spacing['6'],
          paddingVertical: spacing['5'],
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Image
        source={require('../../assets/logo.png')}
        style={{ width: WIDTH, height: HEIGHT }}
        resizeMode="contain"
        tintColor={colors.accent.DEFAULT}
      />
    </View>
  );
}
