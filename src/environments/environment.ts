/**
 * Local dev environment — used by `ng serve` and `ng build` with no
 * --configuration flag. Points at the backend running via docker-compose +
 * mvnw spring-boot:run on localhost:8080.
 */
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:8080/api',
};
