// ============================================================================
// JUEZ SEGURO - Índice de Servicios
// Exportación centralizada de todos los servicios
// ============================================================================

// Cliente API base
export { api, ApiError, handleApiError } from "./api";
export type { ApiResponse, PaginatedResponse } from "./api";

// Servicios por módulo
export { authService } from "./auth.service";
export { causasService } from "./causas.service";
export type { FiltrosCausas } from "./causas.service";

export { documentosService } from "./documentos.service";
export type { FiltrosDocumentos } from "./documentos.service";

export { audienciasService } from "./audiencias.service";
export type { FiltrosAudiencias } from "./audiencias.service";

export { notificacionesService } from "./notificaciones.service";
export type { FiltrosNotificaciones } from "./notificaciones.service";

export { usuariosService } from "./usuarios.service";
export type { FiltrosUsuarios, CrearUsuarioRequest, ActualizarUsuarioRequest } from "./usuarios.service";

export { auditoriaService } from "./auditoria.service";
export type { FiltrosAuditoriaExtendidos, EstadisticasAuditoria } from "./auditoria.service";

export { consultaCiudadanaService } from "./consulta-ciudadana.service";
