export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super('La conexión de base de datos no está configurada.');
    this.name = DatabaseNotConfiguredError.name;
  }
}
