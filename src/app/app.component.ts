import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LinksService, Link } from './links.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  private svc = inject(LinksService);

  urlInput = '';
  result   = signal<Link | null>(null);
  error    = signal('');
  links    = signal<Link[]>([]);
  loading  = signal(false);

  ngOnInit(): void {
    this.loadLinks();
  }

  private isHttpUrl(value: string): boolean {
    try {
      const u = new URL(value);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }

  submit(): void {
    if (!this.isHttpUrl(this.urlInput)) {
      this.error.set('Please enter a valid http(s) URL.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.result.set(null);

    this.svc.shorten(this.urlInput).subscribe({
      next: (link) => {
        this.result.set(link);
        this.urlInput = '';
        this.loading.set(false);
        this.loadLinks();
      },
      error: (err) => {
        this.error.set(err.error?.error ?? 'Network error — is the backend running?');
        this.loading.set(false);
      },
    });
  }

  loadLinks(): void {
    this.svc.list().subscribe({
      next: (list) => this.links.set(list),
    });
  }
}
