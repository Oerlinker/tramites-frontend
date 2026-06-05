import { Component, OnInit, AfterViewInit, OnDestroy, signal, inject, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ColaboracionService } from '../../../core/services/colaboracion.service';
import { NlpService, CampoSugerido } from '../../../core/services/nlp.service';
import { AudioRecorderComponent } from '../../../shared/components/audio-recorder/audio-recorder.component';
import { DocumentoService } from '../../../core/services/documento.service';
import { Politica, Documento, PrivilegiosPN } from '../../../shared/models';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface DiagramLane {
  id: string;
  nombre: string;
  color: string;
  departamentoId?: string;
}

interface CampoFormulario {
  id: string;
  etiqueta: string;
  tipo: 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'DATE' | 'SELECT' | 'CHECKBOX' | 'FILE';
  requerido: boolean;
  opciones?: string[];
}

interface DiagramNode {
  id: string;
  type: 'actividad' | 'decision' | 'inicio' | 'fin';
  label: string;
  x: number;
  y: number;
  lane: string; // lane id
  formulario?: CampoFormulario[];
  opciones?: string[];
}

interface DiagramConnection {
  from: string;
  to: string;
}

interface DiagramData {
  lanes: DiagramLane[];
  nodes: DiagramNode[];
  connections: DiagramConnection[];
}

const LANE_COLORS = [
  'rgba(227,242,253,0.4)',
  'rgba(232,245,233,0.4)',
  'rgba(255,248,225,0.4)',
  'rgba(243,229,245,0.4)',
  'rgba(255,235,238,0.4)',
  'rgba(224,247,250,0.4)',
];

const LANE_HEIGHT = 160;

@Component({
  selector: 'app-politica-diagramador',
  imports: [FormsModule, RouterLink, AudioRecorderComponent],
  template: `
<div class="diag-page">
  <div class="diag-header">
    <a routerLink="/politicas" class="btn-back">← Volver</a>
    <h1>{{ isEdit ? 'Editar' : 'Nueva' }} Política</h1>
    <input [(ngModel)]="nombre" placeholder="Nombre de la política" class="nombre-input"/>
    <button (click)="guardar()" [disabled]="loading()" class="btn-save">
      {{ loading() ? 'Guardando...' : 'Guardar Política' }}
    </button>
    <button class="btn-compartir-diag" (click)="abrirModalCompartir()">
      🔗 Compartir
    </button>
    @if (isColaborativo) {
      <div class="colab-bar">
        <span class="ws-dot-colab" [class.online]="colab.connected()"></span>
        <span style="font-size:12px;color:rgba(255,255,255,0.85)">
          {{ colab.connected() ? 'Colaboración activa' : 'Conectando...' }}
        </span>
        @for (c of colaboradoresActivos(); track c) {
          <span class="colab-chip">👤 {{ c }}</span>
        }
      </div>
    }
  </div>
  <div class="diag-desc">
    <input [(ngModel)]="descripcion" placeholder="Descripción..." class="desc-input"/>
    <label><input type="checkbox" [(ngModel)]="activa"/> Activa</label>
    <button class="btn-privilegios" (click)="mostrarPrivilegios.set(!mostrarPrivilegios())">
      🔒 Privilegios
    </button>
  </div>
  @if (mostrarPrivilegios()) {
    <div class="privilegios-panel">
      <div class="priv-header">
        <span>🔒 Control de Acceso a Documentos</span>
        <button class="priv-close" (click)="mostrarPrivilegios.set(false)">✕</button>
      </div>
      <div class="priv-body">
        @for (permiso of permisosConfig; track permiso.key) {
          <div class="priv-row">
            <span class="priv-label">{{ permiso.label }}</span>
            <div class="priv-checks">
              @for (rol of rolesDisponibles; track rol) {
                <label class="priv-check-label">
                  <input type="checkbox"
                         [checked]="tienePrivilegio(permiso.key, rol)"
                         (change)="togglePrivilegio(permiso.key, rol, $any($event.target).checked)"/>
                  {{ rol }}
                </label>
              }
            </div>
          </div>
        }
      </div>
    </div>
  }
  @if (error()) { <div class="error-bar">{{ error() }}</div> }
  <div class="diag-toolbar">
    <span>Agregar:</span>
    <button (click)="addNode('inicio')" class="tb-btn">Inicio</button>
    <button (click)="addNode('actividad')" class="tb-btn">Actividad</button>
    <button (click)="addNode('decision')" class="tb-btn">Decision</button>
    <button (click)="addNode('fin')" class="tb-btn">Fin</button>
    <button (click)="addLane()" class="tb-btn" style="margin-left:12px">+ Carril</button>
    <button (click)="toggleConnect()" [class.active]="connectMode" class="tb-btn" style="margin-left:12px">
      {{ connectMode ? 'Conectando... (clic en destino)' : 'Modo Conexion' }}
    </button>
    <button (click)="deleteSelected()" class="tb-btn danger" style="margin-left:8px">Eliminar</button>
    <div class="export-wrap" style="margin-left:12px">
      @if (exportando()) {
        <span class="tb-btn" style="cursor:default;opacity:0.7">⏳ Exportando...</span>
      } @else {
        <button class="tb-btn export-btn" (click)="exportMenuOpen.set(!exportMenuOpen())">
          ⬇ Exportar ▾
        </button>
        @if (exportMenuOpen()) {
          <div class="export-dropdown">
            <button class="export-option" (click)="exportarPNG()">🖼 PNG</button>
            <button class="export-option" (click)="exportarPDF()">📄 PDF</button>
          </div>
        }
      }
    </div>
    <button class="tb-btn ia-btn" (click)="abrirPanelIA()" style="margin-left:8px">
      🤖 IA
    </button>
    <span style="margin-left:auto;font-size:12px;color:#888">Pasos: {{ getActividades().length }}</span>
  </div>
  @if (mostrarPanelIA()) {
    <div class="ia-panel">
      <div class="ia-panel-header">
        <span>🤖 Asistente IA</span>
        <button class="ia-close" (click)="mostrarPanelIA.set(false)">✕</button>
      </div>
      <div class="ia-panel-body">
        <div class="ia-modo-selector">
          <button class="ia-modo-btn" [class.active]="modoIA() === 'generar'" (click)="modoIA.set('generar')">
            🆕 Generar nuevo diagrama
          </button>
          <button class="ia-modo-btn" [class.active]="modoIA() === 'editar'" (click)="modoIA.set('editar')">
            ✏️ Modificar diagrama actual
          </button>
        </div>
        <p class="ia-hint">
          @if (modoIA() === 'generar') { Describe el proceso y la IA generará un diagrama nuevo. }
          @else { Indica qué cambiar y la IA modificará el diagrama existente. }
        </p>
        <textarea
          [(ngModel)]="consultaIA"
          class="ia-textarea"
          rows="5"
          [placeholder]="modoIA() === 'generar'
            ? 'Ej: proceso de aprobación de facturas con revisión del contador'
            : 'Ej: agrega una actividad de verificación de identidad antes del pago'"
          [disabled]="cargandoIA()">
        </textarea>
        @if (iaExito()) {
          <div class="ia-success">✅ Elementos agregados al diagrama</div>
        }
        @if (iaError()) {
          <div class="ia-error">{{ iaError() }}</div>
        }
        <button class="ia-btn-generar" (click)="enviarConsultaIA()" [disabled]="cargandoIA() || !consultaIA.trim()">
          @if (cargandoIA()) {
            <span class="ia-spinner"></span> Generando...
          } @else {
            Generar elementos
          }
        </button>
      </div>
    </div>
  }
  <div class="diag-canvas-wrap" #canvasWrap>
    <div class="diag-canvas" #canvas [style.height.px]="canvasHeight()" [style.width.px]="canvasWidth()" (click)="onCanvasClick($event)">
      <svg class="svg-layer" #svgLayer [attr.height]="canvasHeight()" [attr.width]="canvasWidth()"></svg>
      @for (lane of lanes; track lane.id; let i = $index) {
        <div class="lane"
          [style.top.px]="getLaneDimensions()[i].top"
          [style.height.px]="getLaneDimensions()[i].height"
          [style.background]="lane.color">
          <div class="lane-label-wrap">
            @if (editingLaneId === lane.id) {
              <input class="lane-name-input" [(ngModel)]="lane.nombre"
                     (blur)="editingLaneId = null"
                     (keydown.enter)="editingLaneId = null" autofocus/>
              <select class="lane-depto-select" [(ngModel)]="lane.departamentoId">
                <option value="">Sin depto.</option>
                @for (d of departamentos(); track d.id) {
                  <option [value]="d.id">{{ d.nombre }}</option>
                }
              </select>
            } @else {
              <span class="lane-label" (click)="startEditLane(lane.id)">
                {{ lane.nombre }}
                @if (lane.departamentoId) {
                  <span class="lane-depto-badge">✓</span>
                } @else {
                  <span class="lane-depto-badge warn">!</span>
                }
              </span>
            }
            @if (lanes.length > 1) {
              <button class="lane-del" (click)="deleteLane(lane)" title="Eliminar carril">×</button>
            }
          </div>
        </div>
      }
      @for (node of nodes; track node.id) {
        <div
          [class]="'node node-' + node.type + (selected?.id === node.id ? ' selected' : '') + (connectFrom?.id === node.id ? ' connect-source' : '')"
          [style.left.px]="node.x"
          [style.top.px]="node.y"
          (mousedown)="onNodeMouseDown($event, node)"
          (click)="onNodeClick($event, node)">
          @if (node.type === 'decision') {
            <span class="decision-label">{{ node.label || '?' }}</span>
          } @else if (node.type !== 'inicio' && node.type !== 'fin') {
            {{ node.label }}
          }
        </div>
      }
    </div>
  </div>
  @if (selected && selected.type !== 'inicio' && selected.type !== 'fin') {
    <div class="drawer-overlay" (click)="onDrawerOverlayClick($event)"></div>
    <div class="node-drawer">
      <div class="drawer-header">
        <span class="drawer-title">
          @if (selected.type === 'actividad') { 📋 Actividad }
          @else if (selected.type === 'decision') { 🔀 Decisión }
        </span>
        <button class="drawer-close" (click)="selected = null">✕</button>
      </div>
      <div class="drawer-body">
      <div class="node-editor-top">
        <label>Etiqueta:</label>
        <input [(ngModel)]="selected.label"
               (ngModelChange)="onLabelChange()"
               class="label-input"/>
        <label>Carril:</label>
        <select [(ngModel)]="selected.lane" (ngModelChange)="moveNodeToLane(selected)" class="lane-select">
          @for (lane of lanes; track lane.id) {
            <option [value]="lane.id">{{ lane.nombre }}</option>
          }
        </select>
      </div>
      @if (selected.type === 'actividad') {
        <div class="formulario-editor">
          <div class="form-editor-header">
            <span>📋 Campos del formulario ({{ getFormulario().length }})</span>
            <div style="display:flex;gap:6px;align-items:center">
              <button (click)="toggleSugerirCamposIA()" class="btn-sugerir-ia">✨ Sugerir con IA</button>
              <app-audio-recorder (camposSugeridos)="onCamposSugeridosAudio($event)"></app-audio-recorder>
              <button (click)="addCampo()" class="btn-add-campo">+ Agregar campo</button>
            </div>
          </div>
          @if (mostrarSugerirCamposIA()) {
            <div class="ia-sugerir-panel">
              <div style="display:flex;gap:6px;align-items:center">
                <input [(ngModel)]="descripcionCamposIA"
                       placeholder="Describe la actividad (ej: solicitar documentos de identidad...)"
                       class="ia-sugerir-input"
                       [disabled]="cargandoCamposIA()"/>
                <button (click)="ejecutarSugerirCamposIA()"
                        [disabled]="cargandoCamposIA() || !descripcionCamposIA.trim()"
                        class="btn-sugerir-ejecutar">
                  @if (cargandoCamposIA()) { ⏳ } @else { Sugerir }
                </button>
              </div>
              @if (errorSugerirCamposIA()) {
                <div class="ia-sugerir-error">{{ errorSugerirCamposIA() }}</div>
              }
              @if (camposSugeridos().length > 0) {
                <div class="campos-sugeridos-lista">
                  <span class="campos-sugeridos-title">Clic para agregar al formulario:</span>
                  @for (cs of camposSugeridos(); track cs.nombre) {
                    <div class="campo-sugerido-row" (click)="agregarCampoSugerido(cs)">
                      <span class="campo-sug-etiqueta">{{ cs.etiqueta }}</span>
                      <span class="campo-sug-tipo">{{ cs.tipo }}</span>
                      @if (cs.requerido) { <span class="campo-sug-req">Req.</span> }
                      <span class="campo-sug-add">+ Agregar</span>
                    </div>
                  }
                </div>
              }
            </div>
          }
          @if (getFormulario().length === 0) {
            <span class="no-campos">Sin formulario — esta actividad no requiere datos</span>
          }
          @for (campo of getFormulario(); track campo.id; let ci = $index) {
            <div class="campo-row">
              <input [(ngModel)]="campo.etiqueta" placeholder="Etiqueta" class="campo-input"/>
              <select [(ngModel)]="campo.tipo" class="campo-select">
                <option value="TEXT">Texto</option>
                <option value="TEXTAREA">Texto largo</option>
                <option value="NUMBER">Número</option>
                <option value="DATE">Fecha</option>
                <option value="SELECT">Lista opciones</option>
                <option value="CHECKBOX">Checkbox</option>
                <option value="FILE">Archivo</option>
              </select>
              <label class="campo-req">
                <input type="checkbox" [(ngModel)]="campo.requerido"/> Req.
              </label>
              @if (campo.tipo === 'SELECT') {
                <input
                  [value]="campo.opciones?.join(',') ?? ''"
                  (change)="updateCampoOpciones(campo, $any($event.target).value)"
                  placeholder="op1,op2,op3" class="campo-opciones"/>
              }
              <button (click)="removeCampo(ci)" class="btn-del-campo">×</button>
            </div>
          }
        </div>
        <div class="docs-actividad-section">
          <div class="docs-act-header">
            <span>📎 Documentos de la actividad ({{ docsActividad().length }})</span>
            <label class="btn-adj-doc">
              📎 Adjuntar
              <input type="file" hidden (change)="subirDocActividad($event)" [disabled]="cargandoDocs()"/>
            </label>
          </div>
          @if (cargandoDocs()) { <span class="docs-loading">Cargando...</span> }
          @if (!cargandoDocs() && docsActividad().length === 0) {
            <span class="no-docs-act">Sin documentos adjuntos</span>
          }
          @for (doc of docsActividad(); track doc.id) {
            <div class="doc-act-row">
              <span class="doc-act-nombre">{{ doc.nombre }}</span>
              <a [href]="doc.url" target="_blank" class="btn-doc-dl" title="Descargar">⬇</a>
              <button (click)="eliminarDocActividad(doc.id)" class="btn-doc-del" title="Eliminar">×</button>
            </div>
          }
        </div>
      }
      @if (selected.type === 'decision') {
        <div class="formulario-editor">
          <div class="form-editor-header">
            <span>🔀 Opciones de decisión ({{ getOpciones().length }})</span>
            <button (click)="addOpcion()" class="btn-add-campo">+ Opción</button>
          </div>
          @for (op of getOpciones(); track $index; let oi = $index) {
            <div class="campo-row">
              <input [(ngModel)]="selected.opciones![oi]" placeholder="Opción" class="campo-input"/>
              <button (click)="removeOpcion(oi)" class="btn-del-campo">×</button>
            </div>
          }
        </div>
      }
      </div>
    </div>
  }
  @if (mostrarModalCompartir()) {
    <div class="modal-overlay-diag" (click)="mostrarModalCompartir.set(false)">
      <div class="modal-compartir-diag" (click)="$event.stopPropagation()">
        <h3>🔗 Compartir Política</h3>
        <div class="modo-options">
          <label class="modo-opt" [class.selected]="modoCompartir === 'READONLY'">
            <input type="radio" [(ngModel)]="modoCompartir" value="READONLY"/>
            👁 Solo lectura
          </label>
          <label class="modo-opt" [class.selected]="modoCompartir === 'COLABORATIVO'">
            <input type="radio" [(ngModel)]="modoCompartir" value="COLABORATIVO"/>
            ✏️ Colaborativo
          </label>
        </div>
        @if (errorCompartir()) {
          <div class="alert-error-diag">{{ errorCompartir() }}</div>
        }
        @if (!linkGenerado()) {
          <button class="btn-generar" (click)="generarLink()"
                  [disabled]="compartirLoading()">
            {{ compartirLoading() ? 'Generando...' : 'Generar Link' }}
          </button>
        } @else {
          <div class="link-box-diag">
            <input type="text" [value]="linkGenerado()" readonly class="link-input-diag"/>
            <button class="btn-copiar-diag" [class.copiado]="linkCopiado()"
                    (click)="copiarLink()">
              {{ linkCopiado() ? '✅ Copiado' : '📋 Copiar' }}
            </button>
          </div>
          @if (modoCompartir === 'COLABORATIVO') {
            <p class="link-hint-diag">✏️ Solo accesible para administradores.</p>
          } @else {
            <p class="link-hint-diag">👁 Cualquier usuario puede ver el diagrama.</p>
          }
        }
        <div class="modal-actions-diag">
          <button class="btn-cerrar-diag" (click)="mostrarModalCompartir.set(false)">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  }
</div>
  `,
  styles: [`
.diag-page { display:flex; flex-direction:column; height:100vh; overflow:hidden; font-family:var(--font-sans); }
.diag-header { display:flex; align-items:center; gap:10px; padding:8px 16px; background:#1a237e; color:#fff; }
.diag-header h1 { font-size:15px; font-weight:500; margin:0; color:#fff; white-space:nowrap; }
.btn-back { color:#fff; text-decoration:none; font-size:13px; opacity:0.8; white-space:nowrap; }
.nombre-input { flex:1; padding:5px 10px; border:1px solid rgba(255,255,255,0.4); border-radius:6px; background:rgba(255,255,255,0.15); color:#fff; font-size:14px; }
.nombre-input::placeholder { color:rgba(255,255,255,0.5); }
.btn-save { padding:5px 16px; background:#fff; color:#1a237e; border:none; border-radius:6px; font-weight:500; cursor:pointer; white-space:nowrap; }
.diag-desc { display:flex; align-items:center; gap:12px; padding:6px 16px; background:#f5f5f5; border-bottom:1px solid #e0e0e0; font-size:13px; }
.desc-input { flex:1; padding:4px 8px; border:1px solid #ddd; border-radius:4px; font-size:13px; }
.error-bar { background:#ffebee; color:#c62828; padding:6px 16px; font-size:13px; }
.diag-toolbar { display:flex; align-items:center; gap:6px; padding:6px 16px; background:#fafafa; border-bottom:1px solid #e0e0e0; flex-wrap:wrap; }
.diag-toolbar span { font-size:12px; color:#666; }
.tb-btn { padding:4px 10px; font-size:12px; border:1px solid #ccc; border-radius:4px; cursor:pointer; background:#fff; }
.tb-btn:hover { background:#f0f0f0; }
.tb-btn.active { background:#1a237e; color:#fff; border-color:#1a237e; }
.tb-btn.danger { color:#c62828; border-color:#ef9a9a; }
.diag-canvas-wrap { flex:1; overflow:auto; background:#f8f8f8; min-height:0; }
.diag-canvas { position:relative; min-width:1100px; }
.svg-layer { position:absolute; top:0; left:0; width:100%; pointer-events:none; z-index:5; }
.lane { position:absolute; left:0; right:0; border-bottom:1px solid #ccc; box-sizing:border-box; }
.lane-label-wrap { position:absolute; left:0; top:0; width:90px; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; border-right:1px solid #ccc; gap:4px; padding:4px; }
.lane-label { font-size:11px; font-weight:500; color:#444; text-align:center; cursor:pointer; word-break:break-word; }
.lane-label:hover { color:#1a237e; text-decoration:underline dotted; }
.lane-name-input { width:72px; font-size:11px; border:1px solid #9fa8da; border-radius:3px; padding:2px 4px; text-align:center; }
.lane-del { background:none; border:none; color:#bbb; font-size:14px; cursor:pointer; line-height:1; padding:0; }
.lane-del:hover { color:#c62828; }
.node { position:absolute; cursor:grab; user-select:none; display:flex; align-items:center; justify-content:center; text-align:center; font-size:11px; font-weight:500; z-index:10; }
.node:active { cursor:grabbing; }
.node.selected { outline:2px solid #1a237e; outline-offset:2px; }
.node.connect-source { outline:2px solid #ff9800; outline-offset:2px; }
.node-inicio { width:32px; height:32px; border-radius:50%; background:#333; color:#fff; }
.node-fin { width:32px; height:32px; border-radius:50%; background:#333; border:3px solid #000; }
.node-actividad { width:120px; height:44px; border-radius:8px; background:#fff; border:1.5px solid #1a237e; color:#0d2b8e; padding:4px 8px; word-break:break-word; }
.node-decision { width:56px; height:56px; background:#fff; border:1.5px solid #f57f17; transform:rotate(45deg); }
.decision-label { display:block; transform:rotate(-45deg); font-size:10px; color:#5d4037; }
.label-input { padding:3px 8px; border:1px solid #9fa8da; border-radius:4px; font-size:13px; width:200px; }
.lane-select { padding:3px 6px; border:1px solid #9fa8da; border-radius:4px; font-size:13px; }
.node-drawer { position:fixed; top:56px; right:0; width:380px; height:calc(100vh - 56px); background:#fff; border-left:2px solid #c5cae9; box-shadow:-4px 0 20px rgba(0,0,0,0.12); z-index:500; display:flex; flex-direction:column; animation:slideInRight 0.2s cubic-bezier(0.4,0,0.2,1); }
@keyframes slideInRight { from { transform:translateX(100%); opacity:0; } to { transform:translateX(0); opacity:1; } }
.drawer-overlay { position:fixed; inset:0; z-index:499; background:transparent; }
.drawer-header { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:#1a237e; color:#fff; flex-shrink:0; }
.drawer-title { font-size:13px; font-weight:600; }
.drawer-close { background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.3); color:#fff; width:26px; height:26px; border-radius:50%; cursor:pointer; font-size:13px; display:flex; align-items:center; justify-content:center; transition:background 0.15s; }
.drawer-close:hover { background:rgba(255,255,255,0.3); }
.drawer-body { flex:1; overflow-y:auto; padding:14px 16px; font-size:13px; display:flex; flex-direction:column; gap:12px; }
.node-editor-top { display:flex; flex-direction:column; gap:8px; margin-bottom:12px; }
.formulario-editor { background:#fff; border:1px solid #c5cae9; border-radius:6px; padding:8px; }
.form-editor-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; font-weight:500; font-size:12px; color:#1a237e; }
.btn-add-campo { padding:3px 10px; background:#1a237e; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:11px; }
.no-campos { font-size:11px; color:#999; font-style:italic; }
.campo-row { display:flex; align-items:center; gap:6px; margin-bottom:4px; flex-wrap:wrap; }
.campo-input { padding:3px 6px; border:1px solid #ddd; border-radius:4px; font-size:12px; width:140px; }
.campo-select { padding:3px 6px; border:1px solid #ddd; border-radius:4px; font-size:12px; }
.campo-req { font-size:11px; display:flex; align-items:center; gap:3px; white-space:nowrap; }
.campo-opciones { padding:3px 6px; border:1px solid #ddd; border-radius:4px; font-size:11px; width:120px; }
.btn-del-campo { background:none; border:none; color:#c62828; font-size:16px; cursor:pointer; padding:0 4px; line-height:1; }
.lane-depto-select { width:72px; font-size:10px; border:1px solid #9fa8da; border-radius:3px; padding:2px; margin-top:2px; }
.lane-depto-badge { font-size:9px; display:block; text-align:center; }
.lane-depto-badge.warn { color:#e65100; font-weight:700; }
.colab-bar { display:flex; align-items:center; gap:8px; margin-left:12px; }
.ws-dot-colab { width:8px; height:8px; border-radius:50%; background:#ccc; flex-shrink:0; }
.ws-dot-colab.online { background:#4caf50; }
.colab-chip { background:rgba(255,255,255,0.2); padding:2px 8px; border-radius:10px; font-size:11px; color:#fff; }
.btn-compartir-diag { padding:5px 14px; background:rgba(255,255,255,0.15); color:#fff; border:1px solid rgba(255,255,255,0.4); border-radius:6px; cursor:pointer; font-size:12px; }
.btn-compartir-diag:hover { background:rgba(255,255,255,0.25); }
.modal-overlay-diag { position:fixed; inset:0; background:rgba(0,0,0,0.55); display:flex; align-items:center; justify-content:center; z-index:2000; }
.modal-compartir-diag { background:#fff; padding:28px; border-radius:12px; width:460px; max-width:95vw; }
.modal-compartir-diag h3 { margin:0 0 18px; color:#1a237e; }
.modo-options { display:flex; flex-direction:column; gap:10px; margin-bottom:16px; }
.modo-opt { display:flex; align-items:center; gap:8px; padding:10px 14px; border:2px solid #e0e0e0; border-radius:8px; cursor:pointer; font-size:0.9rem; }
.modo-opt.selected { border-color:#1a237e; background:#e8eaf6; }
.btn-generar { width:100%; padding:10px; background:#1a237e; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:0.95rem; }
.btn-generar:disabled { opacity:0.6; cursor:default; }
.link-box-diag { display:flex; gap:8px; margin-bottom:8px; }
.link-input-diag { flex:1; padding:8px; border:1px solid #ddd; border-radius:6px; font-size:0.82rem; background:#f5f5f5; }
.btn-copiar-diag { background:#1a237e; color:#fff; border:none; padding:8px 14px; border-radius:6px; cursor:pointer; font-size:0.85rem; transition:background 0.2s; }
.btn-copiar-diag.copiado { background:#2e7d32; }
.link-hint-diag { font-size:0.8rem; color:#666; margin:4px 0 12px; }
.alert-error-diag { background:#ffebee; color:#c62828; padding:8px; border-radius:6px; margin-bottom:12px; font-size:0.85rem; }
.modal-actions-diag { display:flex; justify-content:flex-end; margin-top:12px; }
.btn-cerrar-diag { background:#e0e0e0; color:#333; border:none; padding:8px 18px; border-radius:6px; cursor:pointer; }
.export-wrap { position:relative; }
.export-btn { background:#fff; border:1px solid #ccc; }
.export-dropdown { position:absolute; top:calc(100% + 4px); left:0; background:#fff; border:1px solid #ddd; border-radius:6px; box-shadow:0 4px 12px rgba(0,0,0,0.12); z-index:100; min-width:110px; overflow:hidden; }
.export-option { display:block; width:100%; padding:8px 14px; font-size:12px; border:none; background:none; cursor:pointer; text-align:left; color:#333; }
.export-option:hover { background:#f5f5f5; }
.ia-btn { background:#e8eaf6; color:#1a237e; border-color:#9fa8da; font-weight:500; }
.ia-btn:hover { background:#c5cae9; }
.ia-panel { background:#e8eaf6; border-bottom:2px solid #c5cae9; padding:12px 16px; flex-shrink:0; }
.ia-panel-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; font-weight:600; font-size:13px; color:#1a237e; }
.ia-close { background:none; border:none; font-size:16px; cursor:pointer; color:#666; line-height:1; padding:0 2px; }
.ia-close:hover { color:#c62828; }
.ia-panel-body { display:flex; flex-direction:column; gap:8px; }
.ia-hint { margin:0; font-size:11px; color:#666; }
.ia-textarea { width:100%; box-sizing:border-box; padding:8px 10px; border:1px solid #9fa8da; border-radius:6px; font-size:12px; font-family:inherit; resize:vertical; background:#fff; }
.ia-textarea:focus { outline:none; border-color:#1a237e; }
.ia-textarea:disabled { opacity:0.6; }
.ia-btn-generar { padding:8px 16px; background:#1a237e; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:12px; font-weight:500; display:flex; align-items:center; gap:6px; align-self:flex-start; }
.ia-btn-generar:disabled { opacity:0.55; cursor:default; }
.ia-btn-generar:hover:not(:disabled) { background:#283593; }
.ia-spinner { width:12px; height:12px; border:2px solid rgba(255,255,255,0.4); border-top-color:#fff; border-radius:50%; animation:spin 0.7s linear infinite; display:inline-block; }
@keyframes spin { to { transform:rotate(360deg); } }
.ia-success { background:#e8f5e9; color:#2e7d32; padding:6px 10px; border-radius:5px; font-size:11px; }
.ia-error   { background:#ffebee; color:#c62828; padding:6px 10px; border-radius:5px; font-size:11px; }
.ia-modo-selector { display:flex; gap:6px; margin-bottom:6px; }
.ia-modo-btn { flex:1; padding:5px 8px; font-size:11px; font-weight:500; border:1.5px solid #1a237e; border-radius:5px; cursor:pointer; background:#fff; color:#1a237e; transition:background 0.15s, color 0.15s; }
.ia-modo-btn:hover:not(.active) { background:#e8eaf6; }
.ia-modo-btn.active { background:#1a237e; color:#fff; }
.btn-sugerir-ia { padding:3px 8px; background:#e8eaf6; color:#1a237e; border:1px solid #9fa8da; border-radius:4px; cursor:pointer; font-size:11px; font-weight:500; white-space:nowrap; }
.btn-sugerir-ia:hover { background:#c5cae9; }
.ia-sugerir-panel { background:#f3f4fc; border:1px solid #c5cae9; border-radius:5px; padding:8px; margin:6px 0; display:flex; flex-direction:column; gap:6px; }
.ia-sugerir-input { flex:1; padding:4px 8px; border:1px solid #9fa8da; border-radius:4px; font-size:12px; font-family:inherit; }
.ia-sugerir-input:focus { outline:none; border-color:#1a237e; }
.btn-sugerir-ejecutar { padding:4px 10px; background:#1a237e; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:11px; white-space:nowrap; }
.btn-sugerir-ejecutar:disabled { opacity:0.55; cursor:default; }
.ia-sugerir-error { color:#c62828; font-size:11px; }
.campos-sugeridos-lista { display:flex; flex-direction:column; gap:4px; }
.campos-sugeridos-title { font-size:10px; color:#555; font-style:italic; }
.campo-sugerido-row { display:flex; align-items:center; gap:6px; padding:4px 8px; background:#fff; border:1px solid #c5cae9; border-radius:4px; cursor:pointer; font-size:11px; }
.campo-sugerido-row:hover { background:#e8eaf6; border-color:#1a237e; }
.campo-sug-etiqueta { font-weight:500; color:#1a237e; flex:1; }
.campo-sug-tipo { color:#757575; font-size:10px; background:#ede7f6; padding:1px 5px; border-radius:3px; }
.campo-sug-req { color:#c62828; font-size:10px; font-weight:600; }
.campo-sug-add { margin-left:auto; color:#388e3c; font-weight:500; font-size:10px; }
.docs-actividad-section { background:#fff8e1; border:1px solid #ffe082; border-radius:5px; padding:6px 8px; margin-top:6px; }
.docs-act-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:4px; font-weight:500; font-size:11px; color:#795548; }
.btn-adj-doc { padding:2px 8px; background:#fff3e0; color:#795548; border:1px solid #ffe082; border-radius:4px; cursor:pointer; font-size:11px; }
.btn-adj-doc:hover { background:#ffe082; }
.docs-loading, .no-docs-act { font-size:11px; color:#999; font-style:italic; }
.doc-act-row { display:flex; align-items:center; gap:6px; padding:2px 0; font-size:11px; }
.doc-act-nombre { flex:1; color:#333; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:160px; }
.btn-doc-dl { color:#1565c0; text-decoration:none; font-size:13px; }
.btn-doc-del { background:none; border:none; color:#c62828; font-size:14px; cursor:pointer; padding:0 2px; line-height:1; }
.btn-privilegios { padding:4px 12px; background:#e8eaf6; color:#1a237e; border:1px solid #c5cae9; border-radius:5px; cursor:pointer; font-size:12px; font-weight:500; white-space:nowrap; }
.btn-privilegios:hover { background:#c5cae9; }
.privilegios-panel { background:#fff; border-bottom:2px solid #c5cae9; padding:12px 16px; flex-shrink:0; box-shadow:0 2px 8px rgba(0,0,0,0.08); }
.priv-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; font-weight:600; font-size:13px; color:#1a237e; }
.priv-close { background:none; border:none; font-size:16px; cursor:pointer; color:#666; }
.priv-close:hover { color:#c62828; }
.priv-body { display:flex; flex-direction:column; gap:8px; }
.priv-row { display:flex; align-items:center; gap:12px; padding:6px 10px; background:#f8f9ff; border-radius:6px; border:1px solid #e8eaf6; }
.priv-label { font-size:12px; font-weight:500; color:#333; min-width:160px; }
.priv-checks { display:flex; gap:16px; }
.priv-check-label { display:flex; align-items:center; gap:5px; font-size:12px; color:#555; cursor:pointer; }
.priv-check-label input { cursor:pointer; }
  `]
})
export class PoliticaDiagramadorComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('svgLayer') svgLayerRef!: ElementRef<SVGElement>;
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLDivElement>;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  protected colab = inject(ColaboracionService);
  private cdr = inject(ChangeDetectorRef);
  private nlp = inject(NlpService);
  private docService = inject(DocumentoService);

  readonly LANE_HEIGHT = LANE_HEIGHT;

  isEdit = false;
  isColaborativo = false;
  politicaId: string | null = null;
  nombre = '';
  descripcion = '';
  activa = true;
  privilegios: PrivilegiosPN = {
    verDocumentos: ['ADMIN', 'FUNCIONARIO', 'CLIENTE'],
    subirDocumentos: ['ADMIN', 'FUNCIONARIO'],
    eliminarDocumentos: ['ADMIN'],
    aprobar: ['ADMIN'],
  };
  mostrarPrivilegios = signal(false);
  readonly rolesDisponibles = ['ADMIN', 'FUNCIONARIO', 'CLIENTE'];
  readonly permisosConfig = [
    { key: 'verDocumentos',      label: '👁 Ver documentos' },
    { key: 'subirDocumentos',    label: '📤 Subir documentos' },
    { key: 'eliminarDocumentos', label: '🗑 Eliminar documentos' },
    { key: 'aprobar',            label: '✅ Aprobar/Completar' },
  ];
  loading = signal(false);
  error = signal('');
  departamentos = signal<{id:string, nombre:string}[]>([]);
  colaboradoresActivos = signal<string[]>([]);
  private sub?: any;

  mostrarModalCompartir = signal(false);
  modoCompartir = 'READONLY';
  linkGenerado = signal('');
  linkCopiado = signal(false);
  errorCompartir = signal('');
  compartirLoading = signal(false);

  lanes: DiagramLane[] = this.defaultLanes();
  nodes: DiagramNode[] = [];
  connections: DiagramConnection[] = [];
  selected: DiagramNode | null = null;
  connectMode = false;
  connectFrom: DiagramNode | null = null;
  editingLaneId: string | null = null;
  private nodeCounter = 0;
  private laneCounter = 3;

  getLaneDimensions(): { top: number; height: number }[] {
    const dims: { top: number; height: number }[] = [];
    let top = 0;
    for (const lane of this.lanes) {
      const inLane = this.nodes.filter(n => n.lane === lane.id);
      let height = LANE_HEIGHT;
      if (inLane.length > 0) {
        const maxBottom = Math.max(...inLane.map(n => n.y + this.getNodeH(n)));
        height = Math.max(LANE_HEIGHT, maxBottom - top + 40);
      }
      dims.push({ top, height });
      top += height;
    }
    return dims;
  }

  canvasHeight(): number {
    const dims = this.getLaneDimensions();
    return dims.reduce((sum, d) => sum + d.height, 0) || this.lanes.length * LANE_HEIGHT;
  }

  canvasWidth(): number {
    if (this.nodes.length === 0) return 1100;
    const maxX = Math.max(...this.nodes.map(n => n.x + this.getNodeW(n)));
    return Math.max(1100, maxX + 300);
  }

  defaultLanes(): DiagramLane[] {
    return [
      { id: 'lane0', nombre: 'Cliente', color: LANE_COLORS[0] },
      { id: 'lane1', nombre: 'Funcionario', color: LANE_COLORS[1] },
      { id: 'lane2', nombre: 'Administrador', color: LANE_COLORS[2] },
    ];
  }

  getLaneY(laneId: string): number {
    const idx = this.lanes.findIndex(l => l.id === laneId);
    if (idx < 0) return 0;
    return this.getLaneDimensions()[idx]?.top ?? 0;
  }

  getLaneFromY(y: number): string {
    const dims = this.getLaneDimensions();
    for (let i = 0; i < this.lanes.length; i++) {
      if (y < dims[i].top + dims[i].height) return this.lanes[i].id;
    }
    return this.lanes[this.lanes.length - 1]?.id ?? this.lanes[0].id;
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit = true;
      this.politicaId = id;
      this.api.get<any>(`/politicas/${id}`).subscribe({
        next: p => {
          this.nombre = p.nombre;
          this.descripcion = p.descripcion || '';
          this.activa = p.activa;
          if (p.privilegios) { this.privilegios = p.privilegios; }
          if (p.diagramJson) {
            try {
              const data: DiagramData = JSON.parse(p.diagramJson);
              this.lanes = data.lanes?.length ? data.lanes : this.defaultLanes();
              this.lanes = this.lanes.map(l => ({ departamentoId: '', ...l }));
              this.laneCounter = this.lanes.length;
              this.nodes = data.nodes || [];
              this.connections = data.connections || [];
              this.nodeCounter = Math.max(...this.nodes.map(n => parseInt(n.id.replace('n','')) || 0), 0);
              if ((data as any).privilegios) { this.privilegios = (data as any).privilegios; }
              setTimeout(() => this.renderConnections(), 100);
            } catch {
              this.initDefaultDiagram();
            }
          } else {
            this.initDefaultDiagram();
          }

          const modo = this.route.snapshot.queryParamMap.get('modo')
            ?? (this.route.snapshot.url[0]?.path === 'colaborar' ? 'COLABORATIVO' : 'READONLY');

          if (modo === 'COLABORATIVO') {
            this.isColaborativo = true;
            this.colab.conectar(this.politicaId!);
            this.sub = this.colab.cambios$.subscribe(msg => {
              if (msg.autor && msg.autor === this.colab.username) return;

              if (msg.lanes) this.lanes = msg.lanes;

              if (msg.nodes) {
                const remoteNodes: DiagramNode[] = msg.nodes;
                remoteNodes.forEach((remoteNode: DiagramNode) => {
                  const local = this.nodes.find(n => n.id === remoteNode.id);
                  if (local) {
                    local.x = remoteNode.x;
                    local.y = remoteNode.y;
                    local.label = remoteNode.label;
                    local.lane = remoteNode.lane;
                    local.type = remoteNode.type;
                  } else {
                    this.nodes.push(remoteNode);
                  }
                });
                this.nodes = this.nodes.filter(n =>
                  remoteNodes.some((r: DiagramNode) => r.id === n.id)
                );
              }

              if (msg.connections) this.connections = msg.connections;

              this.renderConnections();
              this.cdr.detectChanges();
            });
          }
        }
      });
    } else {
      this.initDefaultDiagram();
    }
    this.api.get<any[]>('/departamentos').subscribe({
      next: d => this.departamentos.set(d.filter((x:any) => x.activo)),
      error: () => {}
    });
  }

  ngAfterViewInit() {
    setTimeout(() => this.renderConnections(), 200);
  }

  initDefaultDiagram() {
    this.lanes = this.defaultLanes();
    this.laneCounter = 3;
    this.addNodeAt('inicio', 110, 20, 'lane0', '');
    this.addNodeAt('actividad', 220, 18, 'lane0', 'Solicitar tramite');
    this.addNodeAt('actividad', 360, LANE_HEIGHT + 20, 'lane1', 'Revisar solicitud');
    this.addNodeAt('fin', 700, LANE_HEIGHT * 2 + 20, 'lane2', '');
    this.connections = [
      { from: this.nodes[0].id, to: this.nodes[1].id },
      { from: this.nodes[1].id, to: this.nodes[2].id },
      { from: this.nodes[2].id, to: this.nodes[3].id },
    ];
    setTimeout(() => this.renderConnections(), 100);
  }

  addNodeAt(type: DiagramNode['type'], x: number, y: number, lane: string, label: string): DiagramNode {
    this.nodeCounter++;
    const node: DiagramNode = { id: 'n' + this.nodeCounter, type, label, x, y, lane };
    if (type === 'decision') node.opciones = ['Sí', 'No'];
    this.nodes.push(node);
    return node;
  }

  addNode(type: DiagramNode['type']) {
    const defaultLane = this.lanes[1]?.id ?? this.lanes[0].id;
    const y = this.getLaneY(defaultLane) + 50;
    const x = 100 + this.nodes.length * 15;
    const label = type === 'actividad' ? 'Actividad ' + (this.nodeCounter + 1) : (type === 'decision' ? '?' : '');
    this.addNodeAt(type, x, y, defaultLane, label);
    setTimeout(() => this.renderConnections(), 50);
    if (this.isColaborativo) {
      setTimeout(() => this.colab.publicar(this.politicaId!, { lanes: this.lanes, nodes: this.nodes, connections: this.connections, autor: this.colab.username }), 100);
    }
  }

  addLane() {
    const colorIdx = this.laneCounter % LANE_COLORS.length;
    this.lanes = [...this.lanes, {
      id: 'lane' + this.laneCounter,
      nombre: 'Carril ' + (this.laneCounter + 1),
      color: LANE_COLORS[colorIdx],
    }];
    this.laneCounter++;
    setTimeout(() => this.renderConnections(), 50);
  }

  deleteLane(lane: DiagramLane) {
    if (this.lanes.length <= 1) return;
    const fallbackId = this.lanes.find(l => l.id !== lane.id)!.id;
    this.nodes = this.nodes.map(n => n.lane === lane.id ? { ...n, lane: fallbackId, y: this.getLaneY(fallbackId) + 50 } : n);
    this.lanes = this.lanes.filter(l => l.id !== lane.id);
    setTimeout(() => this.renderConnections(), 50);
  }

  startEditLane(laneId: string) {
    this.editingLaneId = laneId;
  }

  onNodeMouseDown(e: MouseEvent, node: DiagramNode) {
    if (this.connectMode) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX - node.x;
    const startY = e.clientY - node.y;
    let stableTop = 0;
    const stableDims: { id: string; top: number; height: number }[] = [];
    for (const lane of this.lanes) {
      const count = this.nodes.filter(n => n.id !== node.id && n.lane === lane.id).length;
      const height = Math.max(LANE_HEIGHT, count * 60 + 40);
      stableDims.push({ id: lane.id, top: stableTop, height });
      stableTop += height;
    }
    const getStableLaneFromY = (y: number): string => {
      for (const dim of stableDims) {
        if (y < dim.top + dim.height) return dim.id;
      }
      return stableDims[stableDims.length - 1].id;
    };
    let lastBroadcast = 0;
    const onMove = (ev: MouseEvent) => {
      node.x = ev.clientX - startX;
      node.y = ev.clientY - startY;
      node.lane = getStableLaneFromY(node.y);
      this.renderConnections();
      const now = Date.now();
      if (this.isColaborativo && now - lastBroadcast > 16) {
        lastBroadcast = now;
        this.colab.publicar(this.politicaId!, {
          lanes: this.lanes,
          nodes: this.nodes,
          connections: this.connections,
          autor: this.colab.username
        });
      }
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      this.renderConnections();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  onNodeClick(e: MouseEvent, node: DiagramNode) {
    e.stopPropagation();
    if (this.connectMode) {
      if (!this.connectFrom) {
        this.connectFrom = node;
      } else if (this.connectFrom.id !== node.id) {
        this.connections.push({ from: this.connectFrom.id, to: node.id });
        this.connectFrom = null;
        this.connectMode = false;
        this.renderConnections();
        if (this.isColaborativo) {
          this.colab.publicar(this.politicaId!, { lanes: this.lanes, nodes: this.nodes, connections: this.connections, autor: this.colab.username });
        }
      }
      return;
    }
    this.selected = node;
    if (node.type === 'actividad') {
      this.cargarDocsActividad(node.id);
    } else {
      this.docsActividad.set([]);
    }
  }

  onCanvasClick(e: MouseEvent) {
    this.selected = null;
    this.docsActividad.set([]);
    if (this.connectMode && this.connectFrom) this.connectFrom = null;
  }

  onDrawerOverlayClick(e: MouseEvent) {
    this.selected = null;
    this.docsActividad.set([]);
  }

  moveNodeToLane(node: DiagramNode) {
    node.y = this.getLaneY(node.lane) + 50;
    this.renderConnections();
  }

  toggleConnect() {
    this.connectMode = !this.connectMode;
    this.connectFrom = null;
  }

  deleteSelected() {
    if (!this.selected) return;
    this.connections = this.connections.filter(c => c.from !== this.selected!.id && c.to !== this.selected!.id);
    this.nodes = this.nodes.filter(n => n.id !== this.selected!.id);
    this.selected = null;
    this.renderConnections();
    if (this.isColaborativo) {
      this.colab.publicar(this.politicaId!, { lanes: this.lanes, nodes: this.nodes, connections: this.connections, autor: this.colab.username });
    }
  }

  onLabelChange(): void {
    this.renderConnections();
    if (this.isColaborativo) {
      this.colab.publicar(this.politicaId!, {
        lanes: this.lanes,
        nodes: this.nodes,
        connections: this.connections,
        autor: this.colab.username
      });
    }
  }

  getActividades(): DiagramNode[] {
    return this.nodes.filter(n => n.type === 'actividad' || n.type === 'decision');
  }

  getFormulario(): CampoFormulario[] {
    if (!this.selected) return [];
    if (!this.selected.formulario) this.selected.formulario = [];
    return this.selected.formulario;
  }

  addCampo(): void {
    if (!this.selected) return;
    if (!this.selected.formulario) this.selected.formulario = [];
    const newId = 'campo_' + Date.now();
    this.selected.formulario.push({
      id: newId, etiqueta: 'Nuevo campo',
      tipo: 'TEXT', requerido: false
    });
  }

  removeCampo(index: number): void {
    if (!this.selected?.formulario) return;
    this.selected.formulario.splice(index, 1);
  }

  updateCampoOpciones(campo: CampoFormulario, value: string): void {
    campo.opciones = value.split(',').map(s => s.trim()).filter(Boolean);
  }

  getOpciones(): string[] {
    if (!this.selected) return [];
    if (!this.selected.opciones) this.selected.opciones = ['Sí', 'No'];
    return this.selected.opciones;
  }

  addOpcion(): void {
    if (!this.selected) return;
    if (!this.selected.opciones) this.selected.opciones = ['Sí', 'No'];
    this.selected.opciones.push('Nueva opción');
  }

  removeOpcion(index: number): void {
    if (!this.selected?.opciones) return;
    this.selected.opciones.splice(index, 1);
  }

  renderConnections() {
    const svg = this.svgLayerRef?.nativeElement;
    if (!svg) return;
    svg.innerHTML = '<defs><marker id="arr" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#1a237e"/></marker></defs>';
    this.connections.forEach(c => {
      const fn = this.nodes.find(n => n.id === c.from);
      const tn = this.nodes.find(n => n.id === c.to);
      if (!fn || !tn) return;
      const x1 = fn.x + this.getNodeW(fn) / 2, y1 = fn.y + this.getNodeH(fn) / 2;
      const x2 = tn.x + this.getNodeW(tn) / 2, y2 = tn.y + this.getNodeH(tn) / 2;
      const mx = (x1 + x2) / 2;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`);
      path.setAttribute('stroke', '#1a237e');
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('fill', 'none');
      path.setAttribute('marker-end', 'url(#arr)');
      svg.appendChild(path);
    });
  }

  getNodeW(n: DiagramNode): number {
    if (n.type === 'actividad') return 120;
    if (n.type === 'decision') return 56;
    return 32;
  }

  getNodeH(n: DiagramNode): number {
    if (n.type === 'actividad') return 44;
    if (n.type === 'decision') return 56;
    return 32;
  }

  guardar() {
    if (!this.nombre.trim()) { this.error.set('Ingresa un nombre'); return; }
    this.loading.set(true);
    this.error.set('');
    const actividades = this.getActividades();
    const pasos = actividades.map((n, i) => {
      const lane = this.lanes.find(l => l.id === n.lane);
      return {
        orden: i + 1,
        nombre: n.label || 'Paso ' + (i + 1),
        descripcion: n.label || '',
        rolRequerido: lane?.nombre ?? n.lane,
        departamentoId: lane?.departamentoId ?? null,
        nombreDepartamento: lane?.nombre ?? null,
        obligatorio: true,
        formulario: n.formulario ?? [],
      };
    });
    const body = {
      nombre: this.nombre,
      descripcion: this.descripcion,
      activa: this.activa,
      pasos,
      diagramJson: JSON.stringify({ lanes: this.lanes, nodes: this.nodes, connections: this.connections, privilegios: this.privilegios }),
    };
    const req = this.isEdit
      ? this.api.put<Politica>(`/politicas/${this.politicaId}`, body)
      : this.api.post<Politica>('/politicas', body);
    req.subscribe({
      next: saved => {
        if (this.isColaborativo && this.politicaId) {
          this.colab.publicar(this.politicaId, {
            lanes: this.lanes, nodes: this.nodes, connections: this.connections
          });
        }
        this.router.navigate(['/politicas']);
      },
      error: err => { this.error.set(err.error?.mensaje ?? 'Error al guardar'); this.loading.set(false); }
    });
  }

  abrirModalCompartir(): void {
    this.linkGenerado.set('');
    this.linkCopiado.set(false);
    this.errorCompartir.set('');
    this.modoCompartir = 'READONLY';
    this.mostrarModalCompartir.set(true);
  }

  generarLink(): void {
    if (!this.politicaId) return;
    this.compartirLoading.set(true);
    this.errorCompartir.set('');
    this.api.post<any>(`/politicas/${this.politicaId}/compartir`,
      { modo: this.modoCompartir }).subscribe({
      next: res => {
        const base = window.location.origin;
        if (this.modoCompartir === 'COLABORATIVO') {
          this.linkGenerado.set(`${base}/politicas/colaborar/${this.politicaId}`);
        } else {
          this.linkGenerado.set(`${base}/politicas/compartido/${res.token}`);
        }
        this.compartirLoading.set(false);
      },
      error: () => {
        this.errorCompartir.set('Error al generar link');
        this.compartirLoading.set(false);
      }
    });
  }

  copiarLink(): void {
    navigator.clipboard.writeText(this.linkGenerado()).then(() => {
      this.linkCopiado.set(true);
      setTimeout(() => this.linkCopiado.set(false), 2000);
    });
  }

  exportando = signal(false);
  exportMenuOpen = signal(false);

  async exportarPNG() {
    this.exportMenuOpen.set(false);
    this.exportando.set(true);
    try {
      const canvas = await html2canvas(this.canvasRef.nativeElement, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#f8f8f8',
        scale: 2,
      });
      const link = document.createElement('a');
      link.download = `${this.nombre || 'diagrama'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      this.exportando.set(false);
    }
  }

  async exportarPDF() {
    this.exportMenuOpen.set(false);
    this.exportando.set(true);
    try {
      const canvas = await html2canvas(this.canvasRef.nativeElement, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#f8f8f8',
        scale: 2,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', compress: true });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
      const imgW = canvas.width * ratio;
      const imgH = canvas.height * ratio;
      const offsetX = (pageW - imgW) / 2;
      const offsetY = (pageH - imgH) / 2;
      pdf.addImage(imgData, 'PNG', offsetX, offsetY, imgW, imgH);
      pdf.save(`${this.nombre || 'diagrama'}.pdf`);
    } finally {
      this.exportando.set(false);
    }
  }

  mostrarPanelIA = signal(false);
  consultaIA = '';
  cargandoIA = signal(false);
  iaExito = signal(false);
  iaError = signal('');
  departamentosDisponibles = signal<string[]>([]);
  modoIA = signal<'generar' | 'editar'>('generar');

  mostrarSugerirCamposIA = signal(false);
  descripcionCamposIA = '';
  cargandoCamposIA = signal(false);
  camposSugeridos = signal<CampoSugerido[]>([]);
  errorSugerirCamposIA = signal('');

  docsActividad = signal<Documento[]>([]);
  cargandoDocs = signal(false);

  abrirPanelIA(): void {
    this.mostrarPanelIA.update(v => !v);
    this.iaExito.set(false);
    this.iaError.set('');
    const nombres = this.departamentos().map(d => d.nombre);
    if (nombres.length > 0) {
      this.departamentosDisponibles.set(nombres);
    } else {
      this.api.get<any[]>('/departamentos').subscribe({
        next: d => this.departamentosDisponibles.set(
          d.filter((x: any) => x.activo).map((x: any) => x.nombre)
        ),
        error: () => {}
      });
    }
  }

  enviarConsultaIA(): void {
    if (!this.consultaIA.trim()) return;

    const esGenerar = this.modoIA() === 'generar';

    if (esGenerar && !confirm('¿Generar diagrama con IA? Esto reemplazará el diagrama actual.')) return;

    this.cargandoIA.set(true);
    this.iaExito.set(false);
    this.iaError.set('');

    let contexto: string;
    if (esGenerar) {
      contexto = `Usa EXACTAMENTE estos nombres para los swimlanes (son los departamentos reales del sistema): ${this.departamentosDisponibles().join(', ')}. Agrega también un swimlane "Cliente" para el solicitante. No uses otros nombres de swimlanes.`;
    } else {
      const diagramaActual = JSON.stringify({
        lanes: this.lanes,
        nodes: this.nodes.map(n => ({
          id: n.id, type: n.type, label: n.label,
          lane: n.lane, orden: this.nodes.indexOf(n) + 1
        })),
        connections: this.connections
      });
      contexto = `
DIAGRAMA ACTUAL (modifícalo según la instrucción del usuario):
${diagramaActual}

Departamentos disponibles: ${this.departamentosDisponibles().join(', ')}

INSTRUCCIONES:
- Devuelve el diagrama COMPLETO modificado, no solo los cambios
- Mantén los nodos existentes que no deban cambiar
- Puedes agregar, eliminar o modificar nodos según la instrucción
- Usa EXACTAMENTE los mismos nombres de swimlanes del diagrama actual
- Responde SOLO con el JSON válido, sin texto adicional
      `.trim();
    }

    this.api.consultarIA(this.consultaIA, contexto).subscribe({
      next: (res: any) => {
        const elementos: any[] = res.elementos ?? res.elements ?? [];
        const tipoMap: Record<string, DiagramNode['type']> = {
          inicio: 'inicio', accion: 'actividad', actividad: 'actividad',
          decision: 'decision', fin: 'fin'
        };

        this.nodes = [];
        this.lanes = [];
        this.connections = [];
        this.nodeCounter = 0;
        this.laneCounter = 0;

        const generatedIds: string[] = [];

        elementos.forEach((el: any) => {
          const type = tipoMap[el.tipo] ?? 'actividad';
          const carrilNombre: string = el.carril ?? el.lane ?? el.swimlane ?? 'Funcionario';
          let laneIndex = this.lanes.findIndex(l => l.nombre === carrilNombre);
          if (laneIndex === -1) {
            const colorIdx = this.laneCounter % LANE_COLORS.length;
            this.lanes = [...this.lanes, { id: 'lane' + this.laneCounter, nombre: carrilNombre, color: LANE_COLORS[colorIdx] }];
            this.laneCounter++;
            laneIndex = this.lanes.length - 1;
          }
          const lane = this.lanes[laneIndex];
          const orden: number = el.orden ?? (generatedIds.length + 1);
          const x = 250 + (orden - 1) * 220;
          const y = laneIndex * LANE_HEIGHT + LANE_HEIGHT / 2 - 20;
          const label: string = el.nombre ?? el.label ?? '';
          const node = this.addNodeAt(type, x, y, lane.id, label);
          generatedIds.push(node.id);
        });

        for (let i = 0; i < generatedIds.length - 1; i++) {
          this.connections.push({ from: generatedIds[i], to: generatedIds[i + 1] });
        }

        setTimeout(() => this.renderConnections(), 50);
        this.iaExito.set(true);
        this.consultaIA = '';
        this.cargandoIA.set(false);
        setTimeout(() => {
          this.mostrarPanelIA.set(false);
          this.iaExito.set(false);
        }, 1500);
      },
      error: (err: any) => {
        this.iaError.set(err?.error?.detail ?? err?.message ?? 'Error al consultar la IA');
        this.cargandoIA.set(false);
      }
    });
  }

  toggleSugerirCamposIA(): void {
    this.mostrarSugerirCamposIA.update(v => !v);
    this.camposSugeridos.set([]);
    this.errorSugerirCamposIA.set('');
    this.descripcionCamposIA = '';
  }

  ejecutarSugerirCamposIA(): void {
    if (!this.descripcionCamposIA.trim()) return;
    this.cargandoCamposIA.set(true);
    this.errorSugerirCamposIA.set('');
    this.camposSugeridos.set([]);
    this.nlp.sugerirFormulario(this.descripcionCamposIA).subscribe({
      next: res => {
        this.camposSugeridos.set(res.campos ?? []);
        this.cargandoCamposIA.set(false);
      },
      error: err => {
        this.errorSugerirCamposIA.set(err?.error?.detail ?? err?.message ?? 'Error al consultar IA');
        this.cargandoCamposIA.set(false);
      }
    });
  }

  agregarCampoSugerido(cs: CampoSugerido): void {
    if (!this.selected) return;
    if (!this.selected.formulario) this.selected.formulario = [];
    const tipoMap: Record<string, CampoFormulario['tipo']> = {
      text: 'TEXT', textarea: 'TEXTAREA', number: 'NUMBER',
      date: 'DATE', select: 'SELECT', checkbox: 'CHECKBOX', file: 'FILE',
    };
    const tipo: CampoFormulario['tipo'] = tipoMap[cs.tipo?.toLowerCase()] ?? (cs.tipo?.toUpperCase() as CampoFormulario['tipo']) ?? 'TEXT';
    this.selected.formulario.push({
      id: 'campo_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      etiqueta: cs.etiqueta,
      tipo,
      requerido: cs.requerido,
    });
  }

  onCamposSugeridosAudio(campos: CampoSugerido[]): void {
    campos.forEach(cs => this.agregarCampoSugerido(cs));
  }

  cargarDocsActividad(id: string): void {
    this.cargandoDocs.set(true);
    this.docsActividad.set([]);
    if (id) {
      this.docService.getByActividad(id).subscribe({
        next: docs => { this.docsActividad.set(docs); this.cargandoDocs.set(false); },
        error: () => { this.docsActividad.set([]); this.cargandoDocs.set(false); }
      });
    } else {
      this.docsActividad.set([]);
      this.cargandoDocs.set(false);
    }
  }

  subirDocActividad(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !this.selected) return;
    const id = this.selected.id;
    this.cargandoDocs.set(true);
    this.docService.upload(file, this.politicaId ?? undefined, undefined, this.selected?.id ?? undefined).subscribe({
      next: doc => { this.docsActividad.update(docs => [...docs, doc]); this.cargandoDocs.set(false); },
      error: () => this.cargandoDocs.set(false),
    });
    (event.target as HTMLInputElement).value = '';
  }

  eliminarDocActividad(docId: string): void {
    this.docService.eliminar(docId).subscribe({
      next: () => this.docsActividad.update(docs => docs.filter(d => d.id !== docId)),
      error: () => {},
    });
  }

  tienePrivilegio(key: string, rol: string): boolean {
    return (this.privilegios as any)[key]?.includes(rol) ?? false;
  }

  togglePrivilegio(key: string, rol: string, checked: boolean): void {
    const lista: string[] = [...((this.privilegios as any)[key] ?? [])];
    if (checked && !lista.includes(rol)) lista.push(rol);
    else if (!checked) lista.splice(lista.indexOf(rol), 1);
    this.privilegios = { ...this.privilegios, [key]: lista };
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    if (this.isColaborativo) this.colab.desconectar();
  }
}
