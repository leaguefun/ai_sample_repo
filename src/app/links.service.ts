import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Link {
  code: string;
  url: string;
  shortUrl: string;
  hits: number;
  createdAt: string;
}

const API_BASE = 'http://localhost:3000';

@Injectable({ providedIn: 'root' })
export class LinksService {
  private http = inject(HttpClient);

  shorten(url: string): Observable<Link> {
    return this.http.post<Link>(`${API_BASE}/api/links`, { url });
  }

  list(): Observable<Link[]> {
    return this.http.get<Link[]>(`${API_BASE}/api/links`);
  }
}
