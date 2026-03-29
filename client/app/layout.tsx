import { ModeToggle } from '@/components/common/theme-toggle';
import { config } from '@/config';
import { ThemeProvider } from '@/providers/theme-provider';
import { AuthTokenProvider } from '@/providers/auth-token-provider';
import { Auth0Provider } from '@auth0/auth0-react';
import { PropsWithChildren } from 'react';

export default function Layout({ children }: PropsWithChildren) {
  return (
    <main>
      <Auth0Provider
        domain={config.AUTH0_DOMAIN}
        clientId={config.AUTH0_CLIENT_ID}
        authorizationParams={{
          redirect_uri: window.location.origin,
          audience: config.AUTH0_IDENTIFIER,
          scope:
            'openid profile email https://www.googleapis.com/auth/drive.file',
        }}
      >
        <AuthTokenProvider>
          <ThemeProvider defaultTheme="dark" storageKey="theme">
            <ModeToggle />
            {children}
          </ThemeProvider>
        </AuthTokenProvider>
      </Auth0Provider>
    </main>
  );
}
