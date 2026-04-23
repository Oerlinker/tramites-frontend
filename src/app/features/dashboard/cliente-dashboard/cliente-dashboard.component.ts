import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SlicePipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { Tramite, PageResponse } from '../../../shared/models';

@Component({
  selector: 'app-cliente-dashboard',
  imports: [RouterLink, SlicePipe],
  templateUrl: './cliente-dashboard.component.html',
  styleUrl: './cliente-dashboard.component.css'
})
export class ClienteDashboardComponent implements OnInit {
  private api = inject(ApiService);

  misTramites = signal<Tramite[]>([]);
  loading = signal(true);

  ngOnInit() {
    this.api.get<PageResponse<Tramite>>('/tramites/mis-tramites', { page: 0, size: 5 }).subscribe({
      next: res => { this.misTramites.set(res.content); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }
}
