import { RouteElement, wrapRoute } from '@/components/routing';
import { RouteConfig } from '@/types';
import { Route } from 'react-router';

export const flattenRoutes = (routes: RouteConfig[]): JSX.Element[] => {
  return routes.map((route) => {
    if ('children' in route) {
      return (
        <Route
          key={route.path}
          path={route.path}
          element={
            route.element ? <RouteElement Component={route.element} /> : null
          }
        >
          {flattenRoutes(route.children)}
        </Route>
      );
    }
    return wrapRoute(route);
  });
};
