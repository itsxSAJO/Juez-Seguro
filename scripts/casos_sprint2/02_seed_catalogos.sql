-- ============================================================================
-- JUEZ SEGURO - Datos Iniciales de Catálogos
-- ============================================================================

-- ============================================================================
-- JURISDICCIONES DE ECUADOR
-- ============================================================================
INSERT INTO jurisdicciones (codigo, nombre, provincia, canton) VALUES
    ('UJ-PIC-QUI', 'Unidad Judicial Civil de Quito', 'Pichincha', 'Quito'),
    ('UJ-PIC-QUI-PEN', 'Unidad Judicial Penal de Quito', 'Pichincha', 'Quito'),
    ('UJ-GUA-GYE', 'Unidad Judicial Civil de Guayaquil', 'Guayas', 'Guayaquil'),
    ('UJ-GUA-GYE-PEN', 'Unidad Judicial Penal de Guayaquil', 'Guayas', 'Guayaquil'),
    ('UJ-AZU-CUE', 'Unidad Judicial de Cuenca', 'Azuay', 'Cuenca'),
    ('UJ-MAN-POR', 'Unidad Judicial de Portoviejo', 'Manabí', 'Portoviejo'),
    ('UJ-TUN-AMB', 'Unidad Judicial de Ambato', 'Tungurahua', 'Ambato'),
    ('UJ-LOJ-LOJ', 'Unidad Judicial de Loja', 'Loja', 'Loja'),
    ('UJ-IMB-IBA', 'Unidad Judicial de Ibarra', 'Imbabura', 'Ibarra'),
    ('UJ-ESM-ESM', 'Unidad Judicial de Esmeraldas', 'Esmeraldas', 'Esmeraldas');

-- ============================================================================
-- TIPOS DE CAUSA
-- ============================================================================
INSERT INTO tipos_causa (codigo, nombre, descripcion, materia) VALUES
    -- Civil
    ('CIV-ORD', 'Juicio Ordinario Civil', 'Proceso civil de conocimiento ordinario', 'CIVIL'),
    ('CIV-SUM', 'Juicio Sumario Civil', 'Proceso civil de trámite sumario', 'CIVIL'),
    ('CIV-EJE', 'Juicio Ejecutivo', 'Cobro de obligaciones con título ejecutivo', 'CIVIL'),
    ('CIV-VOL', 'Jurisdicción Voluntaria', 'Procedimientos de jurisdicción voluntaria', 'CIVIL'),
    
    -- Penal
    ('PEN-ACC', 'Acción Penal Pública', 'Delitos de acción pública', 'PENAL'),
    ('PEN-PRI', 'Acción Penal Privada', 'Delitos de acción privada', 'PENAL'),
    ('PEN-FLA', 'Flagrancia', 'Procedimiento por delito flagrante', 'PENAL'),
    ('PEN-ABR', 'Procedimiento Abreviado', 'Procedimiento penal abreviado', 'PENAL'),
    
    -- Laboral
    ('LAB-ORD', 'Juicio Laboral Ordinario', 'Conflictos laborales individuales', 'LABORAL'),
    ('LAB-COL', 'Conflicto Colectivo', 'Conflictos laborales colectivos', 'LABORAL'),
    
    -- Familia
    ('FAM-DIV', 'Divorcio', 'Disolución del vínculo matrimonial', 'FAMILIA'),
    ('FAM-ALI', 'Alimentos', 'Pensiones alimenticias', 'FAMILIA'),
    ('FAM-TEN', 'Tenencia', 'Tenencia de menores', 'FAMILIA'),
    ('FAM-VIS', 'Régimen de Visitas', 'Establecimiento de visitas', 'FAMILIA'),
    
    -- Constitucional
    ('CON-ACC', 'Acción de Protección', 'Garantía constitucional de protección', 'CONSTITUCIONAL'),
    ('CON-HAB', 'Habeas Corpus', 'Garantía de libertad personal', 'CONSTITUCIONAL'),
    ('CON-HAD', 'Habeas Data', 'Acceso a información personal', 'CONSTITUCIONAL');

-- ============================================================================
-- CAUSA DE EJEMPLO (para pruebas)
-- ============================================================================
INSERT INTO causas (
    numero_causa,
    tipo_causa_id,
    jurisdiccion_id,
    materia,
    estado,
    etapa_procesal,
    fecha_ingreso,
    juez_pseudonimo,
    demandante_pseudonimo,
    demandado_pseudonimo,
    descripcion_publica,
    prioridad
) VALUES (
    '17230-2024-00001',
    (SELECT id FROM tipos_causa WHERE codigo = 'CIV-ORD'),
    (SELECT id FROM jurisdicciones WHERE codigo = 'UJ-PIC-QUI'),
    'CIVIL',
    'EN_TRAMITE',
    'Calificación de demanda',
    CURRENT_DATE,
    'JUEZ_001',
    'PARTE_A_001',
    'PARTE_B_001',
    'Juicio ordinario por incumplimiento de contrato',
    3
);
