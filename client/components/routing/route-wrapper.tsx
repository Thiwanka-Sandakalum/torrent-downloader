import { RouteConfig } from '@/types';
import { Route } from 'react-router';
import { AuthGuard } from '../guard/auth-guard';
import { PublicGuard } from '../guard/public-guard';

export const wrapRoute = (route: RouteConfig) => {
  const Component = route.element;

  if (route.isProtected) {
    return (
      <Route
        key={route.path}
        path={route.path}
        element={
          <AuthGuard>
            <Component />
          </AuthGuard>
        }
      />
    );
  }

  if (!route.isProtected) {
    return (
      <Route
        key={route.path}
        path={route.path}
        element={
          <PublicGuard>
            <Component />
          </PublicGuard>
        }
      />
    );
  }

  return <Route key={route.path} path={route.path} element={<Component />} />;
};
