import { useAuth0 } from '@auth0/auth0-react';
import { useEffect } from 'react';
import { setTokenGetter } from '../services/api';

export function AuthTokenProvider({ children }: { children: React.ReactNode }) {
  const { getAccessTokenSilently } = useAuth0();
  useEffect(() => {
    setTokenGetter(getAccessTokenSilently);
  }, [getAccessTokenSilently]);
  return <>{children}</>;
}
