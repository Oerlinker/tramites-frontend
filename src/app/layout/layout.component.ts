import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from '../shared/components/navbar/navbar.component';
import { SidebarComponent } from '../shared/components/sidebar/sidebar.component';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, NavbarComponent, SidebarComponent],
  template: `
    <app-navbar />
    <div class="app-body">
      <app-sidebar />
      <main class="content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .app-body {
      display: flex;
      height: calc(100vh - 56px);
      overflow: hidden;
    }
    .content {
      flex: 1;
      overflow-y: auto;
      background: #fafafa;
    }
  `]
})
export class LayoutComponent {}
