import { View, Image, Dimensions } from 'react-native';
import { colors, radii, spacing } from '../theme';

const ASPECT_RATIO = 4179 / 988;
const DEFAULT_WIDTH = Math.min(Dimensions.get('window').width * 0.64, 260);

interface Props {
  style?: object;
  width?: number;
}

export function SomnaraLogo({ style, width = DEFAULT_WIDTH }: Props) {
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
        style={{ width, height: width / ASPECT_RATIO }}
        resizeMode="contain"
        tintColor={colors.accent.DEFAULT}
      />
    </View>
  );
}
