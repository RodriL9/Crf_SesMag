import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

type CategoryOption = {
  id: number;
  label: string;
  sub: string;
  icon: string;
  className: string;
};

type Resource = {
  id: string;
  name: string;
  address: string;
  city: string | null;
  state?: string | null;
  zip_code: string;
  phone_number: string | null;
  hours_of_operation?: string | null;
  website?: string | null;
  requirements?: string | null;
  is_verified?: boolean;
  category_name: string | null;
};

type ResourceTag = {
  label: string;
  className: string;
};

type SubmissionForm = {
  zipOrCity: string;
  categoryId: number | null;
  notes: string;
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly apiBaseUrl = 'http://localhost:8080/api';
  private readonly savedResourcesKey = 'crf_saved_resources_local';

  readonly title = 'Community Resource Finder';
  searchInput = '';
  isLoading = false;
  isOffline = false;
  errorMessage = '';
  submissionError = '';
  submissionSuccess = '';
  showRecentsPanel = false;
  recentSearches: string[] = [];
  hasSearched = false;
  selectedCategoryId: number | null = null;
  selectedCategoryLabel = '';
  viewMode: 'landing' | 'categoryResults' | 'savedResources' = 'landing';
  expandedResourceId: string | null = null;
  lastSearchTerm = '';
  resolvedCityName = '';
  allResults: Resource[] = [];
  filteredResults: Resource[] = [];
  savedResources: Resource[] = [];
  showSuggestionForm = false;
  isSubmittingSuggestion = false;
  suggestionForm: SubmissionForm = {
    zipOrCity: '',
    categoryId: null,
    notes: '',
  };

  readonly categories = [
    { id: 1, label: 'Food', sub: 'Pantries & meals', icon: '🍎', className: 'card-food' },
    { id: 2, label: 'Health', sub: 'Clinics & care', icon: '🏥', className: 'card-health' },
    { id: 3, label: 'Jobs', sub: 'Training & work', icon: '💼', className: 'card-jobs' },
    { id: 4, label: 'Housing', sub: 'Shelter & rentals', icon: '🏠', className: 'card-housing' },
    { id: 5, label: 'Legal', sub: 'Aid & rights', icon: '⚖️', className: 'card-legal' },
    { id: 6, label: 'Government', sub: 'Benefits & programs', icon: '🏛️', className: 'card-govt' },
  ] satisfies CategoryOption[];

  private readonly onOfflineHandler = () => {
    this.isOffline = true;
  };

  private readonly onOnlineHandler = () => {
    this.isOffline = false;
  };

  ngOnInit(): void {
    this.loadSavedResources();
    this.refreshRecentSearches();
    this.isOffline = !navigator.onLine;
    window.addEventListener('offline', this.onOfflineHandler);
    window.addEventListener('online', this.onOnlineHandler);
  }

  ngOnDestroy(): void {
    window.removeEventListener('offline', this.onOfflineHandler);
    window.removeEventListener('online', this.onOnlineHandler);
  }

  searchByZip(): void {
    const term = this.searchInput.trim();
    if (!term) {
      this.errorMessage = 'Please enter a ZIP code or city name first.';
      return;
    }

    const keepCategoryView = this.viewMode === 'categoryResults' && this.selectedCategoryId !== null;
    const activeCategoryId = this.selectedCategoryId;
    const activeCategoryLabel = this.selectedCategoryLabel;

    this.errorMessage = '';
    this.submissionError = '';
    this.submissionSuccess = '';
    this.showRecentsPanel = false;
    this.isLoading = true;
    this.hasSearched = true;
    this.lastSearchTerm = term;
    if (!keepCategoryView) {
      this.selectedCategoryId = null;
      this.selectedCategoryLabel = '';
      this.viewMode = 'landing';
    }
    this.filteredResults = [];
    this.allResults = [];

    const isZip = /^\d{5}$/.test(term);
    let params = new HttpParams();

    if (isZip) {
      params = params.set('zip', term);
    } else {
      params = params.set('city', term);
    }

    this.http
      .get<Resource[]>(`${this.apiBaseUrl}/resources/search`, { params })
      .subscribe({
        next: (rows) => {
          this.allResults = rows;
          this.resolvedCityName = this.pickCityName(rows, term);
          this.isLoading = false;
          this.saveRecentSearch(term);
          if (rows.length > 0) {
            this.showSuggestionForm = false;
          }

          if (keepCategoryView && activeCategoryId !== null) {
            this.selectedCategoryId = activeCategoryId;
            this.selectedCategoryLabel = activeCategoryLabel;
            this.filteredResults = rows.filter((item) => {
              const itemCategory = (item.category_name || '').toLowerCase();
              return itemCategory === activeCategoryLabel.toLowerCase();
            });
            this.viewMode = 'categoryResults';
          }
        },
        error: () => {
          this.errorMessage = 'Could not load resources. Make sure backend is running on port 8080.';
          this.isLoading = false;
        },
      });
  }

  openRecents(): void {
    this.refreshRecentSearches();
    this.showRecentsPanel = !this.showRecentsPanel;
  }

  useRecentSearch(term: string): void {
    this.searchInput = term;
    this.showRecentsPanel = false;
    this.searchByZip();
  }

  openSavedResources(): void {
    this.loadSavedResources();
    this.viewMode = 'savedResources';
  }

  openCategory(category: string, categoryId: number): void {
    this.errorMessage = '';
    this.selectedCategoryId = categoryId;
    this.selectedCategoryLabel = category;
    this.expandedResourceId = null;
    this.filteredResults = this.allResults.length
      ? this.allResults.filter((item) => {
          const itemCategory = (item.category_name || '').toLowerCase();
          return itemCategory === category.toLowerCase();
        })
      : [];
    this.viewMode = 'categoryResults';
    if (!this.suggestionForm.categoryId) {
      this.suggestionForm.categoryId = categoryId;
    }
  }

  openCreateAccount(): void {
    alert('Create account page coming next.');
  }

  openLogin(): void {
    alert('Login page coming next.');
  }

  goHome(): void {
    this.viewMode = 'landing';
    this.errorMessage = '';
    this.hasSearched = false;
    this.selectedCategoryId = null;
    this.selectedCategoryLabel = '';
    this.expandedResourceId = null;
    this.lastSearchTerm = '';
    this.resolvedCityName = '';
    this.allResults = [];
    this.filteredResults = [];
    this.searchInput = '';
    this.showSuggestionForm = false;
    this.submissionError = '';
    this.submissionSuccess = '';
    this.loadSavedResources();
  }

  showSuggestResourcePrompt(): void {
    this.showSuggestionForm = true;
    this.submissionError = '';
    this.submissionSuccess = '';
    this.suggestionForm.zipOrCity = this.lastSearchTerm || this.searchInput.trim();
    if (this.selectedCategoryId) {
      this.suggestionForm.categoryId = this.selectedCategoryId;
    }
  }

  setSuggestionCategory(categoryId: number): void {
    this.suggestionForm.categoryId = categoryId;
  }

  submitSuggestion(): void {
    this.submissionError = '';
    this.submissionSuccess = '';

    if (!this.suggestionForm.zipOrCity.trim()) {
      this.submissionError = 'Please enter zip code/city for the suggestion.';
      return;
    }
    if (!this.suggestionForm.categoryId) {
      this.submissionError = 'Please choose a resource type.';
      return;
    }

    this.isSubmittingSuggestion = true;
    this.http
      .post<{ message: string }>(`${this.apiBaseUrl}/submissions`, {
        zipOrCity: this.suggestionForm.zipOrCity.trim(),
        categoryId: this.suggestionForm.categoryId,
        notes: this.suggestionForm.notes.trim() || null,
      })
      .subscribe({
        next: () => {
          this.isSubmittingSuggestion = false;
          this.submissionSuccess = 'Suggestion sent. Admin will review it.';
          this.suggestionForm = {
            zipOrCity: this.lastSearchTerm || this.suggestionForm.zipOrCity,
            categoryId: this.suggestionForm.categoryId,
            notes: '',
          };
        },
        error: () => {
          this.isSubmittingSuggestion = false;
          this.submissionError = 'Could not submit suggestion right now. Please try again.';
        },
      });
  }

  backToLanding(): void {
    this.viewMode = 'landing';
    this.expandedResourceId = null;
  }

  toggleResourceDetails(resourceId: string): void {
    this.expandedResourceId = this.expandedResourceId === resourceId ? null : resourceId;
  }

  get selectedCategory(): CategoryOption | undefined {
    return this.categories.find((item) => item.id === this.selectedCategoryId);
  }

  getLocationSubtitle(): string {
    if (!this.lastSearchTerm && !this.resolvedCityName) return 'Enter zip code/city name to get resources';
    const state = this.filteredResults[0]?.state || 'NJ';
    return `Near ${this.lastSearchTerm} · ${this.resolvedCityName}, ${state}`;
  }

  getResourceTags(resource: Resource): ResourceTag[] {
    const tags: ResourceTag[] = [];
    const todayHours = this.getTodayHours(resource);
    if (todayHours) {
      if (/closed/i.test(todayHours)) {
        tags.push({ label: 'Closed today', className: 'tag-closed' });
      } else {
        tags.push({ label: 'Open today', className: 'tag-open' });
      }
    } else {
      tags.push({ label: 'Hours not listed', className: 'tag-info' });
    }

    if (resource.is_verified) {
      tags.push({ label: 'Verified', className: 'tag-verified' });
    }

    if (resource.website) {
      tags.push({ label: 'Website listed', className: 'tag-info' });
    }

    if (resource.phone_number) {
      tags.push({ label: 'Phone listed', className: 'tag-info' });
    }

    return tags.slice(0, 4);
  }

  getHoursLine(resource: Resource): string {
    const hours = this.getTodayHours(resource) || 'Hours not listed';
    const phone = resource.phone_number || 'Phone not listed';
    return `${hours} · ${phone}`;
  }

  getGoogleMapsUrl(resource: Resource): string {
    const city = resource.city || this.resolvedCityName || '';
    const state = resource.state || 'NJ';
    const location = `${resource.address}, ${city}, ${state} ${resource.zip_code}`.trim();
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
  }

  getGoogleMapsEmbedUrl(resource: Resource): SafeResourceUrl {
    const city = resource.city || this.resolvedCityName || '';
    const state = resource.state || 'NJ';
    const location = `${resource.address}, ${city}, ${state} ${resource.zip_code}`.trim();
    const embedUrl = `https://www.google.com/maps?q=${encodeURIComponent(location)}&output=embed`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
  }

  getResultIcon(index: number): string {
    const iconSets: Record<string, string[]> = {
      food: ['🥫', '🍽️', '🤝', '🥦', '🍎'],
      health: ['🏥', '🩺', '💊', '🧠', '🧑‍⚕️'],
      jobs: ['💼', '📄', '🛠️', '🎓', '📈'],
      housing: ['🏠', '🛏️', '🔑', '🏢', '🧱'],
      legal: ['⚖️', '📜', '🧾', '🛡️', '🏛️'],
      government: ['🏛️', '🗂️', '📋', '🧭', '🪪'],
    };
    const list = iconSets[this.selectedCategoryLabel.toLowerCase()] || ['📍'];
    return list[index % list.length];
  }

  isSavedResource(resourceId: string): boolean {
    return this.savedResources.some((item) => item.id === resourceId);
  }

  toggleSaveResource(resource: Resource): void {
    const exists = this.savedResources.some((item) => item.id === resource.id);
    if (exists) {
      this.savedResources = this.savedResources.filter((item) => item.id !== resource.id);
    } else {
      this.savedResources = [resource, ...this.savedResources].slice(0, 200);
    }
    this.persistSavedResources();
  }

  private persistSavedResources(): void {
    localStorage.setItem(this.savedResourcesKey, JSON.stringify(this.savedResources));
  }

  private loadSavedResources(): void {
    const raw = localStorage.getItem(this.savedResourcesKey);
    if (!raw) {
      this.savedResources = [];
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      this.savedResources = Array.isArray(parsed) ? parsed : [];
    } catch {
      this.savedResources = [];
    }
  }

  private getTodayHours(resource: Resource): string | null {
    if (!resource.hours_of_operation) return null;

    const todayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date()).toLowerCase();
    const lines = resource.hours_of_operation
      .split('|')
      .map((line) => line.trim())
      .filter(Boolean);

    const todayLine = lines.find((line) => line.toLowerCase().startsWith(todayName));
    return todayLine || null;
  }

  private pickCityName(rows: Resource[], fallback: string): string {
    if (!rows.length) return fallback;

    const counts = new Map<string, number>();
    for (const row of rows) {
      const city = (row.city || '').trim();
      if (!city) continue;
      counts.set(city, (counts.get(city) || 0) + 1);
    }

    if (counts.size === 0) return fallback;

    let bestCity = fallback;
    let bestCount = 0;
    counts.forEach((count, city) => {
      if (count > bestCount) {
        bestCount = count;
        bestCity = city;
      }
    });
    return bestCity;
  }

  private saveRecentSearch(term: string): void {
    const key = 'crf_recent_searches';
    const current = this.getRecentSearches();
    const deduped = [term, ...current.filter((item) => item.toLowerCase() !== term.toLowerCase())].slice(0, 8);
    localStorage.setItem(key, JSON.stringify(deduped));
    this.refreshRecentSearches();
  }

  private getRecentSearches(): string[] {
    const key = 'crf_recent_searches';
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item) => typeof item === 'string');
    } catch {
      return [];
    }
  }

  private refreshRecentSearches(): void {
    this.recentSearches = this.getRecentSearches();
  }
}
