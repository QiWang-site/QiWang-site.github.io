(() => {
  "use strict";

  const data = window.SITE_DATA || {};
  const profile = data.profile || {};
  const publications = Array.isArray(data.publications)
    ? data.publications.map((publication, index) => ({ ...publication, _index: index }))
    : [];

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  const asText = (value) => (value === null || value === undefined ? "" : String(value));

  const create = (tagName, className = "", value) => {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (value !== undefined && value !== null) element.textContent = asText(value);
    return element;
  };

  const clear = (element) => {
    if (element) element.replaceChildren();
  };

  const safeUrl = (value) => {
    const url = asText(value).trim();
    return /^https?:\/\//i.test(url) ? url : "#";
  };

  const normalize = (value) => asText(value).toLocaleLowerCase();

  function renderKeywords() {
    const container = $("#keyword-list");
    if (!container) return;
    clear(container);
    (Array.isArray(data.scholarKeywords) ? data.scholarKeywords : []).forEach((keyword) => {
      container.append(create("span", "keyword-chip", keyword));
    });
  }

  function renderScholarStats() {
    const stats = profile.scholarStats || {};
    const values = {
      "#stat-citations": stats.citations,
      "#stat-h-index": stats.hIndex,
      "#stat-i10-index": stats.i10Index,
      "#publication-count": publications.length,
    };

    Object.entries(values).forEach(([selector, value]) => {
      const element = $(selector);
      if (element) element.textContent = Number.isFinite(Number(value)) ? asText(value) : "—";
    });

    const snapshot = $(".scholar-brand > div span");
    if (snapshot && profile.snapshotDate) snapshot.textContent = `Snapshot · ${profile.snapshotDate}`;
  }

  function renderContactDetails() {
    const emailLink = $("a[href^='mailto:']");
    if (emailLink && profile.email) {
      emailLink.href = `mailto:${profile.email}`;
      const value = $("span:not(.contact-label)", emailLink);
      if (value) {
        value.replaceChildren(document.createTextNode(profile.email), create("b", "", "↗"));
      }
    }

    const phoneLink = $("a[href^='tel:']");
    if (phoneLink && profile.phone) {
      const phoneHref = profile.phone.replace(/[^+\d]/g, "");
      phoneLink.href = `tel:${phoneHref}`;
      const value = $("span:not(.contact-label)", phoneLink);
      if (value) {
        value.replaceChildren(document.createTextNode(profile.phone), create("b", "", "↗"));
      }
    }

    $$('a[href*="scholar.google.com"]').forEach((link) => {
      if (profile.scholarUrl) link.href = safeUrl(profile.scholarUrl);
    });
  }

  function publicationType(venue) {
    const value = normalize(venue);
    if (value.includes("patent")) return "Patent";
    if (value.includes("arxiv") || value.includes("preprint")) return "Preprint";
    if (/\b(conference|meeting|symposium|workshop|forum|pesgm)\b/.test(value)) return "Conference";
    return "Article";
  }

  function comparePublications(a, b, sortKey) {
    let comparison = 0;
    if (sortKey === "year-desc") comparison = Number(b.year || 0) - Number(a.year || 0);
    if (sortKey === "year-asc") comparison = Number(a.year || 0) - Number(b.year || 0);
    if (sortKey === "citations-desc") comparison = Number(b.citations || 0) - Number(a.citations || 0);
    if (sortKey === "citations-asc") comparison = Number(a.citations || 0) - Number(b.citations || 0);
    if (comparison !== 0) return comparison;

    // Use year and the original Scholar order as deterministic tie-breakers.
    const yearTie = Number(b.year || 0) - Number(a.year || 0);
    if (yearTie !== 0) return yearTie;
    return Number(a._index || 0) - Number(b._index || 0);
  }

  function renderPublicationList(items) {
    const list = $("#publication-list");
    const empty = $("#publication-empty");
    if (!list) return;

    clear(list);
    items.forEach((publication, index) => {
      const item = create("li", "publication-item");
      const rank = create("span", "pub-rank", String(index + 1).padStart(2, "0"));
      rank.setAttribute("aria-hidden", "true");

      const main = create("div", "pub-main");
      const title = create("a", "pub-title", publication.title || "Untitled work");
      title.href = safeUrl(publication.url);
      title.target = "_blank";
      title.rel = "noreferrer noopener";
      if (publication.url) title.setAttribute("aria-label", `${publication.title || "Publication"} (Google Scholar)`);
      const authors = create("p", "pub-authors", publication.authors);
      const venue = create("p", "pub-venue", publication.venue);
      main.append(title, authors, venue);

      const side = create("div", "pub-side");
      side.append(create("span", "pub-year", publication.year || "—"));

      const citations = create("a", "pub-citations");
      citations.href = safeUrl(publication.url);
      citations.target = "_blank";
      citations.rel = "noreferrer noopener";
      citations.append(
        create("span", "", publication.citationLabel || asText(publication.citations || 0)),
        create("small", "", "cited by"),
      );
      citations.setAttribute("aria-label", `${publication.citations || 0} citations`);
      side.append(citations, create("span", "pub-type", publicationType(publication.venue)));

      item.append(rank, main, side);
      list.append(item);
    });

    if (empty) empty.hidden = items.length !== 0;
  }

  function initPublications() {
    const yearFilter = $("#year-filter");
    const sortSelect = $("#sort-select");
    const searchInput = $("#publication-search");
    const resetButton = $("#reset-filters");
    const resultCount = $("#publication-result-count");
    if (!yearFilter || !sortSelect || !searchInput || !resetButton) return;

    const years = [...new Set(publications.map((publication) => Number(publication.year)).filter(Number.isFinite))]
      .sort((a, b) => b - a);
    yearFilter.replaceChildren(create("option", "", "All years"));
    yearFilter.firstElementChild.value = "all";
    years.forEach((year) => yearFilter.append(create("option", "", year)));

    const state = {
      year: "all",
      sort: sortSelect.value || "citations-desc",
      query: "",
    };

    const update = () => {
      const query = normalize(state.query.trim());
      const filtered = publications
        .filter((publication) => state.year === "all" || asText(publication.year) === state.year)
        .filter((publication) => {
          if (!query) return true;
          const searchable = normalize([
            publication.title,
            publication.authors,
            publication.venue,
          ].join(" "));
          return searchable.includes(query);
        })
        .sort((a, b) => comparePublications(a, b, state.sort));

      renderPublicationList(filtered);
      if (resultCount) {
        resultCount.textContent = `Showing ${filtered.length} of ${publications.length} works`;
      }
    };

    yearFilter.addEventListener("change", () => {
      state.year = yearFilter.value;
      update();
    });
    sortSelect.addEventListener("change", () => {
      state.sort = sortSelect.value;
      update();
    });
    searchInput.addEventListener("input", () => {
      state.query = searchInput.value;
      update();
    });
    resetButton.addEventListener("click", () => {
      state.year = "all";
      state.sort = "citations-desc";
      state.query = "";
      yearFilter.value = "all";
      sortSelect.value = "citations-desc";
      searchInput.value = "";
      update();
    });

    update();
  }

  function renderTimeline(containerSelector, items, education = false) {
    const container = $(containerSelector);
    if (!container) return;
    clear(container);

    (Array.isArray(items) ? items : []).forEach((entry) => {
      const item = create("article", "timeline-item");
      item.append(create("div", "timeline-period", entry.period));

      const body = create("div");
      body.append(create("p", "timeline-institution", entry.institution));
      body.append(create("p", "timeline-role", education ? entry.degree : entry.role));
      if (entry.location) body.append(create("p", "timeline-location", entry.location));
      if (!education && entry.note) body.append(create("p", "timeline-note", entry.note));
      item.append(body);
      container.append(item);
    });
  }

  function renderAwards() {
    const container = $("#award-list");
    if (!container) return;
    clear(container);
    (Array.isArray(data.awards) ? data.awards : []).forEach((award, index) => {
      const item = create("article", "award-item");
      item.append(create("span", "award-index", String(index + 1).padStart(2, "0")));
      const body = create("div");
      body.append(create("h3", "award-title", award.title));
      body.append(create("p", "award-organization", award.organization));
      item.append(body, create("span", "award-year", award.year || "—"));
      container.append(item);
    });
  }

  function renderServiceEntries(containerSelector, entries) {
    const container = $(containerSelector);
    if (!container) return;
    clear(container);
    (Array.isArray(entries) ? entries : []).forEach((entry) => {
      container.append(
        create("p", "service-role", entry.role),
        create("p", "service-detail", entry.detail),
      );
    });
  }

  function renderService() {
    const services = data.services || {};
    renderServiceEntries("#editorial-service", services.editorial);
    renderServiceEntries("#guest-editor-service", services.guestEditor);

    const panelChair = $("#panel-chair-list");
    if (panelChair) {
      clear(panelChair);
      (Array.isArray(services.panelChair) ? services.panelChair : []).forEach((entry) => {
        panelChair.append(create("li", "", entry));
      });
    }

    const reviewerList = $("#reviewer-list");
    if (reviewerList) {
      clear(reviewerList);
      (Array.isArray(services.reviewerGroups) ? services.reviewerGroups : []).forEach((group) => {
        const wrapper = create("div", "reviewer-group");
        wrapper.append(create("p", "reviewer-label", group.label));
        wrapper.append(create("p", "reviewer-detail", group.detail));
        reviewerList.append(wrapper);
      });
    }
  }

  function renderPresentations() {
    const container = $("#presentation-list");
    if (!container) return;
    clear(container);

    const entries = (Array.isArray(data.presentations) ? data.presentations : [])
      .map((entry, index) => ({ ...entry, _index: index }))
      .sort((a, b) => Number(b.year || 0) - Number(a.year || 0) || a._index - b._index);

    entries.forEach((entry) => {
      const item = create("article", "presentation-item");
      item.append(create("span", "presentation-year", entry.year || "—"));
      item.append(create("p", "presentation-event", entry.event));
      item.append(create("h3", "presentation-title", entry.title));
      container.append(item);
    });
  }

  function renderTeaching() {
    const container = $("#teaching-list");
    if (!container) return;
    clear(container);
    const entries = (Array.isArray(data.teaching) ? data.teaching : [])
      .map((entry, index) => ({ ...entry, _index: index }))
      .sort((a, b) => Number(b.year || 0) - Number(a.year || 0) || a._index - b._index);

    entries.forEach((entry) => {
      const item = create("article", "teaching-item");
      item.append(create("span", "teaching-year", entry.year || "—"));
      item.append(create("h3", "teaching-event", entry.event));
      item.append(create("p", "teaching-role", entry.role));
      container.append(item);
    });
  }

  function renderProjects() {
    const container = $("#project-list");
    if (!container) return;
    clear(container);
    (Array.isArray(data.projects) ? data.projects : []).forEach((project) => {
      const item = create("article", "project-item");
      const scheme = create("p", "project-scheme", project.scheme);
      if (project.period) scheme.append(create("span", "project-period", project.period));
      item.append(scheme);
      item.append(create("h3", "project-title", project.title));
      if (project.role) item.append(create("p", "project-role", project.role));
      if (project.institution) item.append(create("p", "project-institution", project.institution));
      if (project.description) item.append(create("p", "project-description", project.description));
      container.append(item);
    });
  }

  function initNavigation() {
    const toggle = $(".nav-toggle");
    const nav = $("#primary-nav");
    if (!toggle || !nav) return;

    const close = () => {
      nav.classList.remove("is-open");
      toggle.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open navigation");
    };

    const open = () => {
      nav.classList.add("is-open");
      toggle.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "Close navigation");
    };

    toggle.addEventListener("click", () => {
      if (nav.classList.contains("is-open")) close();
      else open();
    });
    $$('a[href^="#"]', nav).forEach((link) => link.addEventListener("click", close));
    document.addEventListener("click", (event) => {
      if (nav.classList.contains("is-open") && !nav.contains(event.target) && !toggle.contains(event.target)) close();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth > 680) close();
    });
  }

  function initReveal() {
    const elements = $$(".reveal");
    if (!elements.length) return;

    const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || !("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        currentObserver.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0 });

    elements.forEach((element) => observer.observe(element));
  }

  function init() {
    renderKeywords();
    renderScholarStats();
    renderContactDetails();
    initPublications();
    renderTimeline("#appointment-timeline", data.appointments, false);
    renderTimeline("#education-timeline", data.education, true);
    renderAwards();
    renderService();
    renderPresentations();
    renderTeaching();
    renderProjects();
    initNavigation();
    initReveal();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
