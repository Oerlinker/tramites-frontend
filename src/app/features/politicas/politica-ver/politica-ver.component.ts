import { Component, OnInit, OnDestroy, AfterViewInit, signal, inject, ElementRef, ViewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ColaboracionService } from '../../../core/services/colaboracion.service';
import { Subscription } from 'rxjs';

interface DiagramNode { id: string; type: string; label: string; x: number; y: number; lane: string; }
interface DiagramConnection { from: string; to: string; }
interface DiagramLane { id: string; nombre: string; color: string; departamentoId?: string; }
interface DiagramData { lanes: DiagramLane[]; nodes: DiagramNode[]; connections: DiagramConnection[]; }

const LANE_HEIGHT = 160;

@Component({
  selector: 'app-politica-ver',
  standalone: true,
  imports: [RouterLink],
  template: `
<div class="ver-page">
  <div class="ver-header">
    <a routerLink="/politicas" class="btn-back">← Volver a Políticas</a>
    <div class="ver-title">
      <h1>{{ nombre() }}</h1>
      @if (descripcion()) { <span class="ver-desc">{{ descripcion() }}</span> }
    </div>
    <div class="ws-status">
      <span class="dot" [class.online]="colab.connected()"></span>
      {{ colab.connected() ? 'Colaboración activa' : 'Solo lectura' }}
    </div>
  </div>
  @if (error()) { <div class="error-bar">{{ error() }}</div> }
  @if (loading()) {
    <p class="loading-msg">Cargando diagrama...</p>
  } @else {
    <div class="canvas-wrap" #canvasWrap>
      <div class="diag-canvas" [style.height.px]="canvasHeight()">
        <svg class="svg-layer" #svgLayer [attr.height]="canvasHeight()"></svg>
        @for (lane of lanes(); track lane.id; let i = $index) {
          <div class="lane"
            [style.top.px]="i * LANE_HEIGHT"
            [style.height.px]="LANE_HEIGHT"
            [style.background]="lane.color">
            <div class="lane-label-wrap">
              <span class="lane-label">{{ lane.nombre }}</span>
            </div>
          </div>
        }
        @for (node of nodes(); track node.id) {
          <div [class]="'node node-' + node.type"
               [style.left.px]="node.x"
               [style.top.px]="node.y">
            @if (node.type === 'decision') {
              <span class="decision-label">{{ node.label || '?' }}</span>
            } @else if (node.type !== 'inicio' && node.type !== 'fin') {
              {{ node.label }}
            }
          </div>
        }
      </div>
    </div>
  }
</div>
  `,
  styles: [`
.ver-page { display:flex; flex-direction:column; height:100vh; overflow:hidden; font-family:var(--font-sans,sans-serif); }
.ver-header { display:flex; align-items:center; gap:12px; padding:10px 16px; background:#1a237e; color:#fff; flex-wrap:wrap; }
.ver-title { flex:1; display:flex; flex-direction:column; gap:2px; }
.ver-title h1 { margin:0; font-size:15px; font-weight:500; color:#fff; }
.ver-desc { font-size:12px; opacity:0.75; }
.btn-back { color:#fff; text-decoration:none; font-size:13px; opacity:0.8; white-space:nowrap; }
.ws-status { display:flex; align-items:center; gap:6px; font-size:0.82rem; opacity:0.85; }
.dot { width:8px; height:8px; border-radius:50%; background:#ccc; }
.dot.online { background:#4caf50; }
.error-bar { background:#ffebee; color:#c62828; padding:6px 16px; font-size:13px; }
.loading-msg { padding:40px; text-align:center; color:#888; }
.canvas-wrap { flex:1; overflow:auto; background:#f8f8f8; }
.diag-canvas { position:relative; width:1100px; }
.svg-layer { position:absolute; top:0; left:0; width:100%; pointer-events:none; z-index:5; }
.lane { position:absolute; left:0; right:0; border-bottom:1px solid #ccc; box-sizing:border-box; }
.lane-label-wrap { position:absolute; left:0; top:0; width:90px; height:100%; display:flex; align-items:center; justify-content:center; border-right:1px solid #ccc; padding:4px; }
.lane-label { font-size:11px; font-weight:500; color:#444; text-align:center; word-break:break-word; }
.node { position:absolute; display:flex; align-items:center; justify-content:center; text-align:center; font-size:11px; font-weight:500; z-index:10; user-select:none; }
.node-inicio { width:32px; height:32px; border-radius:50%; background:#333; color:#fff; }
.node-fin { width:32px; height:32px; border-radius:50%; background:#333; border:3px solid #000; }
.node-actividad { width:120px; height:44px; border-radius:8px; background:#fff; border:1.5px solid #1a237e; color:#0d2b8e; padding:4px 8px; word-break:break-word; }
.node-decision { width:56px; height:56px; background:#fff; border:1.5px solid #f57f17; transform:rotate(45deg); }
.decision-label { display:block; transform:rotate(-45deg); font-size:10px; color:#5d4037; }
  `]
})
export class PoliticaVerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('svgLayer') svgLayerRef!: ElementRef<SVGElement>;

  private route = inject(ActivatedRoute);
  protected colab = inject(ColaboracionService);

  readonly LANE_HEIGHT = LANE_HEIGHT;

  nombre = signal('');
  descripcion = signal('');
  loading = signal(true);
  error = signal('');
  lanes = signal<DiagramLane[]>([]);
  nodes = signal<DiagramNode[]>([]);
  connections = signal<DiagramConnection[]>([]);

  private politicaId: string | null = null;
  private sub?: Subscription;

  canvasHeight() { return this.lanes().length * LANE_HEIGHT; }

  ngOnInit() {
    const token = this.route.snapshot.paramMap.get('token');
    const id = this.route.snapshot.paramMap.get('id');

    if (token) {
      this.colab.obtenerPorToken(token).subscribe({
        next: p => { this.cargarDiagrama(p); this.conectarColab(p.id); },
        error: () => { this.error.set('Enlace inválido o expirado'); this.loading.set(false); }
      });
    } else if (id) {
      this.politicaId = id;
      this.colab['api'].get<any>(`/politicas/${id}`).subscribe({
        next: p => { this.cargarDiagrama(p); this.conectarColab(id); },
        error: () => { this.error.set('Error al cargar política'); this.loading.set(false); }
      });
    }
  }

  ngAfterViewInit() {
    setTimeout(() => this.renderConnections(), 200);
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.colab.desconectar();
  }

  private cargarDiagrama(p: any) {
    this.nombre.set(p.nombre);
    this.descripcion.set(p.descripcion || '');
    if (p.diagramJson) {
      try {
        const data: DiagramData = JSON.parse(p.diagramJson);
        this.lanes.set(data.lanes ?? []);
        this.nodes.set(data.nodes ?? []);
        this.connections.set(data.connections ?? []);
      } catch {}
    }
    this.loading.set(false);
    setTimeout(() => this.renderConnections(), 100);
  }

  private conectarColab(id: string) {
    this.politicaId = id;
    this.colab.conectar(id);
    this.sub = this.colab.cambios$.subscribe(data => {
      if (data.lanes) this.lanes.set(data.lanes);
      if (data.nodes) this.nodes.set(data.nodes);
      if (data.connections) this.connections.set(data.connections);
      setTimeout(() => this.renderConnections(), 50);
    });
  }

  private renderConnections() {
    const svg = this.svgLayerRef?.nativeElement;
    if (!svg) return;
    const nodes = this.nodes();
    const getW = (n: DiagramNode) => n.type === 'actividad' ? 120 : n.type === 'decision' ? 56 : 32;
    const getH = (n: DiagramNode) => n.type === 'actividad' ? 44 : n.type === 'decision' ? 56 : 32;
    svg.innerHTML = '<defs><marker id="arr" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#1a237e"/></marker></defs>';
    this.connections().forEach(c => {
      const fn = nodes.find(n => n.id === c.from);
      const tn = nodes.find(n => n.id === c.to);
      if (!fn || !tn) return;
      const x1 = fn.x + getW(fn) / 2, y1 = fn.y + getH(fn) / 2;
      const x2 = tn.x + getW(tn) / 2, y2 = tn.y + getH(tn) / 2;
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
}
