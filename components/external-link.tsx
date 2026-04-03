import { Link } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { type ComponentProps } from 'react';
import { Platform, Pressable } from 'react-native';

type Props = Omit<ComponentProps<typeof Link>, 'href'> & { href: string | any };

export function ExternalLink({ href, ...rest }: Props) {
  if (Platform.OS !== 'web') {
    return (
      <Pressable
        {...(rest as any)}
        onPress={async () => {
          await openBrowserAsync(href as string);
        }}
      />
    );
  }

  // @ts-ignore
  return <Link target="_blank" {...rest} href={href} />;
}
