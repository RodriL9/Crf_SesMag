import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
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
  latitude?: number | string | null;
  longitude?: number | string | null;
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

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  isEmailVerified?: boolean;
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
  private readonly guestSavedResourcesKey = 'crf_saved_resources_local_guest';
  private readonly guestRecentSearchesKey = 'crf_recent_searches_guest';

  readonly title = 'Community Resource Finder';
  searchInput = '';
  isLoading = false;
  isOffline = false;
  errorMessage = '';
  submissionError = '';
  submissionSuccess = '';
  showRecentsPanel = false;
  recentSearches: string[] = [];
  isRequestingLocation = false;
  locationStatusMessage = '';
  userLocation: { lat: number; lng: number } | null = null;
  hasSearched = false;
  selectedCategoryId: number | null = null;
  selectedCategoryLabel = '';
  viewMode: 'landing' | 'categoryResults' | 'savedResources' | 'login' | 'forgotPassword' | 'register' | 'userDashboard' = 'landing';
  expandedResourceId: string | null = null;
  lastSearchTerm = '';
  resolvedCityName = '';
  allResults: Resource[] = [];
  filteredResults: Resource[] = [];
  savedResources: Resource[] = [];
  currentUser: AuthUser | null = null;
  authToken = '';
  authMessage = '';
  isSyncingSaved = false;
  flaggingResourceId: string | null = null;
  flagReason = '';
  flagError = '';
  flagSuccess = '';
  showSuggestionForm = false;
  isSubmittingSuggestion = false;
  loginEmail = '';
  loginPassword = '';
  loginRole: 'user' | 'admin' = 'user';
  loginError = '';
  loginSuccess = '';
  isLoggingIn = false;
  forgotPasswordEmail = '';
  forgotPasswordError = '';
  forgotPasswordSuccess = '';
  isSendingResetLink = false;
  registerFirstName = '';
  registerLastName = '';
  registerEmail = '';
  registerRole: 'user' | 'admin' = 'user';
  registerPassword = '';
  registerConfirmPassword = '';
  registerError = '';
  registerSuccess = '';
  isRegistering = false;
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
    this.loadAuthSession();
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

  requestCurrentLocation(): void {
    this.locationStatusMessage = '';
    if (!('geolocation' in navigator)) {
      this.locationStatusMessage = 'Geolocation is not supported on this device.';
      return;
    }

    this.isRequestingLocation = true;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        this.isRequestingLocation = false;
        this.locationStatusMessage = 'Using your current location for distance estimates.';
      },
      () => {
        this.isRequestingLocation = false;
        this.locationStatusMessage = 'Could not access your location. You can still search by ZIP/city.';
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }

  clearCurrentLocation(): void {
    this.userLocation = null;
    this.locationStatusMessage = 'Location disabled. Distances are hidden.';
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
    this.viewMode = 'register';
    this.registerError = '';
    this.registerSuccess = '';
    this.registerEmail = this.loginEmail.trim();
  }

  openLogin(): void {
    this.viewMode = 'login';
    this.loginError = '';
    this.loginSuccess = '';
  }

  openUserDashboard(): void {
    if (!this.currentUser) {
      this.openLogin();
      return;
    }
    this.authMessage = '';
    this.viewMode = 'userDashboard';
  }

  openForgotPassword(): void {
    this.viewMode = 'forgotPassword';
    this.forgotPasswordError = '';
    this.forgotPasswordSuccess = '';
    this.forgotPasswordEmail = this.loginEmail.trim();
  }

  backToLogin(): void {
    this.viewMode = 'login';
    this.forgotPasswordError = '';
  }

  goHome(): void {
    if (this.currentUser) {
      this.clearAuthSession();
    }
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
    this.authMessage = '';
    this.loadSavedResources();
  }

  handleTopTitleClick(): void {
    if (this.currentUser) return;
    this.goHome();
  }

  submitLogin(): void {
    this.loginError = '';
    this.loginSuccess = '';

    const email = this.loginEmail.trim();
    const password = this.loginPassword;

    if (!email || !password) {
      this.loginError = 'Please enter both email and password.';
      return;
    }

    this.isLoggingIn = true;
    this.http
      .post<{ token: string; user: { name?: string; email: string; role?: 'user' | 'admin' } }>(
        `${this.apiBaseUrl}/auth/login`,
        {
          email,
          password,
        }
      )
      .subscribe({
        next: (response) => {
          this.isLoggingIn = false;
          const returnedRole = (response.user?.role || 'user') as 'user' | 'admin';
          if (returnedRole !== this.loginRole) {
            this.loginError = `This account is registered as ${returnedRole}. Please switch login type.`;
            return;
          }
          localStorage.setItem('crf_auth_token', response.token);
          localStorage.setItem('crf_auth_user', JSON.stringify(response.user));
          this.loadAuthSession();
          this.savedResources = [];
          this.recentSearches = [];
          this.loadSavedResources();
          this.refreshRecentSearches();
          this.loginSuccess = `Signed in successfully${response.user?.name ? `, ${response.user.name}` : ''}.`;
          this.viewMode = returnedRole === 'user' ? 'userDashboard' : 'landing';
        },
        error: (err) => {
          this.isLoggingIn = false;
          this.loginError = err?.error?.error || 'Sign-in failed. Please check your credentials.';
        },
      });
  }

  logout(): void {
    this.clearAuthSession();
    this.authMessage = 'You have been logged out.';
    this.viewMode = 'landing';
  }

  syncSavedResourcesFromServer(showStatus = true): void {
    if (!this.currentUser || !this.authToken) return;
    this.isSyncingSaved = true;
    if (showStatus) {
      this.authMessage = '';
    }

    this.http
      .get<Resource[]>(`${this.apiBaseUrl}/saved`, { headers: this.getAuthHeaders() })
      .subscribe({
        next: (serverSaved) => {
          this.savedResources = serverSaved;
          this.persistSavedResources();
          this.isSyncingSaved = false;
          if (showStatus) {
            this.authMessage = 'Loaded saved resources from your account.';
          }
        },
        error: () => {
          this.isSyncingSaved = false;
          if (showStatus) {
            this.authMessage = 'Could not connect account saved resources.';
          }
        },
      });
  }

  submitForgotPassword(): void {
    this.forgotPasswordError = '';
    this.forgotPasswordSuccess = '';

    const email = this.forgotPasswordEmail.trim();
    if (!email) {
      this.forgotPasswordError = 'Please enter your email address.';
      return;
    }

    this.isSendingResetLink = true;
    this.http
      .post<{ message?: string }>(`${this.apiBaseUrl}/auth/forgot-password`, { email })
      .subscribe({
        next: () => {
          this.isSendingResetLink = false;
          this.forgotPasswordSuccess =
            "Check your inbox. If an account exists for that email, you'll receive a reset link within a few minutes.";
        },
        error: () => {
          this.isSendingResetLink = false;
          this.forgotPasswordSuccess =
            "Check your inbox. If an account exists for that email, you'll receive a reset link within a few minutes.";
        },
      });
  }

  submitRegister(): void {
    this.registerError = '';
    this.registerSuccess = '';

    const firstName = this.registerFirstName.trim();
    const lastName = this.registerLastName.trim();
    const email = this.registerEmail.trim();
    const password = this.registerPassword;
    const confirmPassword = this.registerConfirmPassword;
    const fullName = `${firstName} ${lastName}`.trim();

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      this.registerError = 'Please complete all fields.';
      return;
    }
    if (password.length < 8) {
      this.registerError = 'Password must be at least 8 characters.';
      return;
    }
    if (password !== confirmPassword) {
      this.registerError = 'Passwords do not match.';
      return;
    }

    this.isRegistering = true;
    this.http
      .post<{ message?: string }>(`${this.apiBaseUrl}/auth/register`, {
        name: fullName,
        email,
        role: this.registerRole,
        password,
      })
      .subscribe({
        next: () => {
          this.isRegistering = false;
          this.registerSuccess =
            'Account created. Check your email for the verification link, then sign in.';
          this.loginEmail = email;
          this.registerPassword = '';
          this.registerConfirmPassword = '';
        },
        error: (err) => {
          this.isRegistering = false;
          this.registerError = err?.error?.error || 'Could not create account right now. Please try again.';
        },
      });
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

  getDistanceLabel(resource: Resource): string {
    if (!this.userLocation) return '';
    const lat = Number(resource.latitude);
    const lng = Number(resource.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 'Distance unavailable';

    const miles = this.calculateDistanceMiles(this.userLocation.lat, this.userLocation.lng, lat, lng);
    return `${miles.toFixed(1)} mi`;
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

    if (!this.currentUser || !this.authToken) return;

    if (exists) {
      this.http
        .delete(`${this.apiBaseUrl}/saved/${resource.id}`, { headers: this.getAuthHeaders() })
        .subscribe({
          error: () => {
            this.authMessage = 'Could not unsave from account. Local save was updated only.';
          },
        });
      return;
    }

    this.http
      .post(
        `${this.apiBaseUrl}/saved`,
        { resourceId: resource.id },
        { headers: this.getAuthHeaders() }
      )
      .subscribe({
        error: () => {
          this.authMessage = 'Could not save to account. Local save still worked.';
        },
      });
  }

  openFlagResource(resourceId: string): void {
    this.flaggingResourceId = resourceId;
    this.flagReason = '';
    this.flagError = '';
    this.flagSuccess = '';
  }

  cancelFlagResource(): void {
    this.flaggingResourceId = null;
    this.flagReason = '';
    this.flagError = '';
    this.flagSuccess = '';
  }

  submitFlagResource(resource: Resource): void {
    this.flagError = '';
    this.flagSuccess = '';

    if (!this.currentUser) {
      this.flagError = 'Please log in as a user to flag resources.';
      return;
    }

    const categoryId = this.getCategoryIdByName(resource.category_name);
    if (!categoryId) {
      this.flagError = 'Could not identify category for this resource.';
      return;
    }

    const reason = this.flagReason.trim();
    if (!reason) {
      this.flagError = 'Please describe what needs review.';
      return;
    }

    const zipOrCity = resource.zip_code || resource.city || this.lastSearchTerm || 'Unknown area';
    this.http
      .post<{ message: string }>(`${this.apiBaseUrl}/submissions`, {
        zipOrCity,
        categoryId,
        resourceName: resource.name,
        notes: `FLAGGED RESOURCE (${resource.id}) by ${this.currentUser.email}: ${reason}`,
      })
      .subscribe({
        next: () => {
          this.flagSuccess = 'Flag sent for admin review. Thank you.';
          this.flagReason = '';
        },
        error: () => {
          this.flagError = 'Could not submit flag right now. Please try again.';
        },
      });
  }

  private persistSavedResources(): void {
    localStorage.setItem(this.getSavedResourcesKey(), JSON.stringify(this.savedResources));
  }

  private loadSavedResources(): void {
    if (this.currentUser && this.authToken) {
      const localAccountCache = localStorage.getItem(this.getSavedResourcesKey());
      if (localAccountCache) {
        try {
          const parsed = JSON.parse(localAccountCache);
          this.savedResources = Array.isArray(parsed) ? parsed : [];
        } catch {
          this.savedResources = [];
        }
      } else {
        this.savedResources = [];
      }
      this.syncSavedResourcesFromServer(false);
      return;
    }

    const raw = localStorage.getItem(this.getSavedResourcesKey());
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

  private calculateDistanceMiles(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const earthRadiusMiles = 3958.8;

    const dLat = toRadians(toLat - fromLat);
    const dLng = toRadians(toLng - fromLng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(fromLat)) *
        Math.cos(toRadians(toLat)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusMiles * c;
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
    const key = this.getRecentSearchesKey();
    const current = this.getRecentSearches();
    const deduped = [term, ...current.filter((item) => item.toLowerCase() !== term.toLowerCase())].slice(0, 8);
    localStorage.setItem(key, JSON.stringify(deduped));
    this.refreshRecentSearches();
  }

  private getRecentSearches(): string[] {
    const key = this.getRecentSearchesKey();
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

  private loadAuthSession(): void {
    const token = localStorage.getItem('crf_auth_token');
    const rawUser = localStorage.getItem('crf_auth_user');
    if (!token || !rawUser) {
      this.currentUser = null;
      this.authToken = '';
      return;
    }

    try {
      const parsed = JSON.parse(rawUser) as AuthUser;
      this.currentUser = parsed;
      this.authToken = token;
    } catch {
      this.currentUser = null;
      this.authToken = '';
      localStorage.removeItem('crf_auth_token');
      localStorage.removeItem('crf_auth_user');
    }
  }

  private getAuthHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.authToken}`,
    });
  }

  private getCategoryIdByName(categoryName: string | null): number | null {
    if (!categoryName) return null;
    const match = this.categories.find((item) => item.label.toLowerCase() === categoryName.toLowerCase());
    return match?.id ?? null;
  }

  private clearAuthSession(): void {
    localStorage.removeItem('crf_auth_token');
    localStorage.removeItem('crf_auth_user');
    this.currentUser = null;
    this.authToken = '';
    this.userLocation = null;
    this.locationStatusMessage = '';
    this.loadSavedResources();
    this.refreshRecentSearches();
  }

  private getSavedResourcesKey(): string {
    if (!this.currentUser) return this.guestSavedResourcesKey;
    return `crf_saved_resources_${this.currentUser.id}`;
  }

  private getRecentSearchesKey(): string {
    if (!this.currentUser) return this.guestRecentSearchesKey;
    return `crf_recent_searches_${this.currentUser.id}`;
  }
}
