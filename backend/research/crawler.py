import re
import urllib.parse
import urllib.robotparser
import xml.etree.ElementTree as ET
import requests
from bs4 import BeautifulSoup
from typing import Dict, List, Any, Optional, Set, Tuple
import logging

logger = logging.getLogger(__name__)

USER_AGENT = "Mozilla/5.0 (compatible; MeruguBPOIntelligence/2.0; +https://meruguglobal.com/research-bot)"
DEFAULT_TIMEOUT = 10
MAX_PAGES_TO_CRAWL = 10
MAX_PAGE_TEXT_LENGTH = 12000

# Tech signatures detected via headers, script src, meta, and DOM patterns
TECH_SIGNATURES = {
    # CMS & Platforms
    'WordPress': [r'wp-content', r'wp-includes', r'wordpress'],
    'Shopify': [r'cdn\.shopify\.com', r'Shopify\.theme', r'shopify-payment-button'],
    'WooCommerce': [r'woocommerce', r'wc-ajax'],
    'Webflow': [r'webflow\.com', r'wf-site', r'assets\.website-files\.com'],
    'HubSpot CMS': [r'js\.hs-scripts\.com', r'hs-analytics', r'hs-scripts'],
    'Squarespace': [r'static1\.squarespace\.com', r'squarespace-core'],
    'Wix': [r'static\.wixstatic\.com', r'wix-warmup-data'],
    'Magento': [r'mage/cookies', r'skin/frontend'],
    
    # Frontend Frameworks
    'React': [r'react', r'data-reactroot', r'_next/static', r'react-dom'],
    'Next.js': [r'_next/static', r'__NEXT_DATA__'],
    'Vue.js': [r'vue\.js', r'v-data', r'nuxt'],
    'Nuxt.js': [r'_nuxt', r'__NUXT__'],
    'Angular': [r'ng-version', r'angular\.js', r'ng-app'],
    'Tailwind CSS': [r'tailwind'],
    'Bootstrap': [r'bootstrap\.min\.css', r'bootstrap\.min\.js'],
    
    # Analytics & Tag Management
    'Google Analytics 4': [r'gtag\(\'config\'', r'googletagmanager\.com/gtag', r'analytics\.js'],
    'Google Tag Manager': [r'googletagmanager\.com/gtm\.js'],
    'Meta Pixel': [r'connect\.facebook\.net/en_US/fbevents\.js', r'fbq\('],
    'LinkedIn Insight': [r'snap\.licdn\.com/li\.lms-analytics'],
    'Hotjar': [r'static\.hotjar\.com'],
    
    # Customer Support & Chat
    'Intercom': [r'widget\.intercom\.io', r'intercomSettings'],
    'Zendesk': [r'static\.zdassets\.com', r'zopim'],
    'Drift': [r'js\.driftt\.com'],
    'HubSpot Chat': [r'js\.hs-scripts\.com'],
    'Freshdesk': [r'assets\.freshdesk\.com', r'freshworks'],
    'Tidio': [r'code\.tidio\.co'],
    
    # Payments & Cloud Infrastructure
    'Stripe': [r'js\.stripe\.com'],
    'PayPal': [r'paypal\.com/sdk'],
    'Cloudflare': [r'cloudflare\.com', r'cf-ray', r'__cfwaitingroom'],
    'AWS CloudFront': [r'cloudfront\.net'],
    'Amazon AWS': [r'amazonaws\.com', r'aws\.amazon\.com'],
    'Fastly': [r'fastly\.net'],
}

PAGE_TAXONOMY_PATTERNS = {
    'ABOUT': [
        r'/about', r'/about-us', r'/who-we-are', r'/our-story',
        r'/company/about', r'/our-mission', r'/overview'
    ],
    'OVERVIEW': [
        r'/leadership', r'/team', r'/management', r'/board-of-directors',
        r'/executives', r'/our-team'
    ],
    'PRODUCTS': [
        r'/products', r'/product', r'/platform', r'/features',
        r'/software', r'/app', r'/technology-platform'
    ],
    'SERVICES': [
        r'/services', r'/service', r'/capabilities', r'/offerings',
        r'/consulting', r'/our-services', r'/what-we-do'
    ],
    'SOLUTIONS': [
        r'/solutions', r'/use-cases', r'/applications', r'/business-solutions'
    ],
    'INDUSTRIES': [
        r'/industries', r'/sectors', r'/verticals', r'/who-we-serve',
        r'/markets'
    ],
    'CASE_STUDIES': [
        r'/case-studies', r'/customers', r'/customer-stories',
        r'/success-stories', r'/testimonials', r'/portfolio', r'/clients'
    ],
    'PARTNERS': [
        r'/partners', r'/alliances', r'/channel-partners', r'/ecosystem'
    ],
    'TECHNOLOGY': [
        r'/technology', r'/tech-stack', r'/architecture', r'/developer',
        r'/developers', r'/integrations', r'/api', r'/docs'
    ],
    'CAREERS': [
        r'/careers', r'/jobs', r'/openings', r'/join-our-team',
        r'/work-with-us', r'/opportunities'
    ],
    'NEWS': [
        r'/news', r'/press', r'/press-releases', r'/blog', r'/insights',
        r'/media'
    ],
    'CONTACT': [
        r'/contact', r'/contact-us', r'/get-in-touch', r'/locations',
        r'/offices', r'/reach-us'
    ],
    'PRICING': [
        r'/pricing', r'/plans', r'/packages', r'/compare-plans'
    ]
}

# Tracking query parameters to strip
TRACKING_PARAMS = {
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'gclid', 'fbclid', 'ref', 'source', 'mc_cid', 'mc_eid', 'msclkid'
}

class RespectfulWebsiteCrawler:
    """
    Enterprise controlled website discovery and crawling engine.
    Discovers high-priority business pages, respects robots.txt, parses sitemaps,
    extracts structured text excerpts with sentence positions, and identifies tech stacks.
    """

    def __init__(self, raw_url: str, company_name: str = ""):
        self.company_name = company_name.strip()
        self.normalized_url, self.canonical_domain = self.normalize_url(raw_url)
        self.parsed_base = urllib.parse.urlparse(self.normalized_url)
        self.base_domain = self.parsed_base.netloc.lower()
        
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.8',
            'Cache-Control': 'no-cache',
        })
        self.robot_parser: Optional[urllib.robotparser.RobotFileParser] = None
        self.crawl_delay: float = 0.5
        self.is_blocked_by_cloudflare: bool = False
        self.discovered_urls: Set[str] = set()
        self.crawled_urls: Set[str] = set()

    @staticmethod
    def normalize_url(raw_url: str) -> Tuple[str, str]:
        """
        Normalizes any input URL: ensures protocol, removes trailing slash and query params.
        Returns (normalized_url, domain).
        """
        if not raw_url:
            return ("", "")
        clean = raw_url.strip()
        if not clean.startswith(('http://', 'https://')):
            clean = 'https://' + clean

        parsed = urllib.parse.urlparse(clean)
        domain = parsed.netloc.lower().split(':')[0]
        # Remove www. for canonical domain identifier
        canonical_domain = re.sub(r'^www\.', '', domain)
        path = parsed.path.rstrip('/')
        normalized = f"{parsed.scheme}://{parsed.netloc}{path}" if path else f"{parsed.scheme}://{parsed.netloc}"
        return (normalized, canonical_domain)

    @staticmethod
    def strip_tracking_params(url: str) -> str:
        """Removes tracking query parameters (utm_*, gclid, etc.) and fragments."""
        parsed = urllib.parse.urlparse(url)
        if not parsed.query:
            return urllib.parse.urlunparse((parsed.scheme, parsed.netloc, parsed.path.rstrip('/'), '', '', ''))
        
        query_dict = urllib.parse.parse_qs(parsed.query)
        clean_query = {k: v for k, v in query_dict.items() if k.lower() not in TRACKING_PARAMS}
        new_query_str = urllib.parse.urlencode(clean_query, doseq=True)
        return urllib.parse.urlunparse((parsed.scheme, parsed.netloc, parsed.path.rstrip('/'), '', new_query_str, ''))

    def verify_company_domain_match(self) -> Tuple[bool, int, str]:
        """
        Verifies whether the website domain reasonably corresponds to the supplied company name.
        Returns (is_match, confidence, reason).
        """
        if not self.company_name or not self.canonical_domain:
            return (True, 50, "Insufficient information to verify domain correspondence.")

        comp_clean = re.sub(r'[^a-z0-9]', '', self.company_name.lower())
        # Strip common company suffixes
        for suffix in ['tech', 'technologies', 'solutions', 'systems', 'global', 'corp', 'inc', 'llc', 'ltd', 'pvt', 'services', 'ai', 'io', 'software', 'group']:
            comp_clean = re.sub(f"{suffix}$", '', comp_clean)

        dom_name = self.canonical_domain.split('.')[0]
        dom_clean = re.sub(r'[^a-z0-9]', '', dom_name)

        if comp_clean in dom_clean or dom_clean in comp_clean:
            return (True, 95, f"Domain '{self.canonical_domain}' matches company name '{self.company_name}'.")

        # Fuzzy overlap check
        if len(comp_clean) >= 4 and comp_clean[:4] in dom_clean:
            return (True, 75, f"Partial match between domain '{self.canonical_domain}' and company '{self.company_name}'.")

        return (False, 40, f"Domain '{self.canonical_domain}' does not explicitly match company name '{self.company_name}'. Manual verification suggested.")

    def check_robots_txt(self) -> None:
        """Fetches and parses robots.txt to respect site policies and crawl delays."""
        try:
            robots_url = f"{self.parsed_base.scheme}://{self.parsed_base.netloc}/robots.txt"
            resp = self.session.get(robots_url, timeout=5)
            if resp.status_code == 200 and resp.text:
                rp = urllib.robotparser.RobotFileParser()
                rp.parse(resp.text.splitlines())
                self.robot_parser = rp
                delay = rp.crawl_delay(USER_AGENT)
                if delay and delay > 0:
                    self.crawl_delay = min(delay, 2.0)
                logger.info(f"Loaded robots.txt for {self.base_domain} (delay={self.crawl_delay}s)")
        except Exception as e:
            logger.debug(f"Could not read robots.txt for {self.base_domain}: {e}")

    def is_allowed_by_robots(self, target_url: str) -> bool:
        if self.robot_parser:
            try:
                return self.robot_parser.can_fetch(USER_AGENT, target_url)
            except Exception:
                return True
        return True

    def discover_sitemap_urls(self) -> List[Tuple[str, str]]:
        """
        Tries to locate and parse /sitemap.xml to discover official company pages.
        Returns list of (page_type, url).
        """
        discovered: List[Tuple[str, str]] = []
        candidate_sitemaps = [
            f"{self.parsed_base.scheme}://{self.parsed_base.netloc}/sitemap.xml",
            f"{self.parsed_base.scheme}://{self.parsed_base.netloc}/sitemap_index.xml",
        ]
        
        for s_url in candidate_sitemaps:
            try:
                resp = self.session.get(s_url, timeout=5)
                if resp.status_code == 200 and 'xml' in resp.headers.get('Content-Type', '').lower():
                    root = ET.fromstring(resp.content)
                    # XML namespaces often present: {http://www.sitemaps.org/schemas/sitemap/0.9}loc
                    for elem in root.iter():
                        if elem.tag.endswith('loc') and elem.text:
                            url = elem.text.strip()
                            if self.is_same_domain(url):
                                p_type = self.classify_url_category(url)
                                if p_type != 'OTHER':
                                    discovered.append((p_type, self.strip_tracking_params(url)))
                if discovered:
                    break
            except Exception:
                continue
        return discovered

    def is_same_domain(self, target_url: str) -> bool:
        parsed = urllib.parse.urlparse(target_url)
        return parsed.netloc.lower() == self.base_domain or parsed.netloc.lower() == f"www.{self.base_domain}" or f"www.{parsed.netloc.lower()}" == self.base_domain

    def classify_url_category(self, url: str) -> str:
        """Classifies a URL into a business intelligence page category based on path and anchor keywords."""
        path = urllib.parse.urlparse(url).path.lower()
        for p_type, patterns in PAGE_TAXONOMY_PATTERNS.items():
            for pat in patterns:
                if re.search(pat, path, re.IGNORECASE):
                    return p_type
        return 'OTHER'

    def detect_technologies(self, html_text: str, headers: Dict[str, str]) -> List[str]:
        """Scans page HTML, scripts, stylesheets, and HTTP response headers for technology signatures."""
        detected = []
        # Header signatures
        server_header = headers.get('Server', '')
        if 'cloudflare' in server_header.lower():
            detected.append('Cloudflare')
        if 'nginx' in server_header.lower():
            detected.append('Nginx')

        for tech, patterns in TECH_SIGNATURES.items():
            if tech in detected:
                continue
            for pat in patterns:
                if re.search(pat, html_text, re.IGNORECASE):
                    detected.append(tech)
                    break
        return detected

    def fetch_page(self, url: str, discovery_method: str = "HOMEPAGE_LINK") -> Dict[str, Any]:
        """
        Fetches an individual webpage, cleans content, extracts sentences and metadata,
        and handles HTTP errors and anti-bot challenges gracefully.
        """
        clean_url = self.strip_tracking_params(url)
        res: Dict[str, Any] = {
            'url': clean_url,
            'status_code': 0,
            'title': '',
            'meta_description': '',
            'text': '',
            'sentences': [],
            'technologies': [],
            'has_chat': False,
            'word_count': 0,
            'is_accessible': False,
            'crawl_error': None,
            'discovery_method': discovery_method,
            'outbound_internal_links': [],
            'social_links': {},
        }

        if not self.is_allowed_by_robots(clean_url):
            res['crawl_error'] = "Restricted by robots.txt"
            return res

        try:
            resp = self.session.get(clean_url, timeout=DEFAULT_TIMEOUT, allow_redirects=True)
            res['status_code'] = resp.status_code

            # Check bot blocks / Cloudflare challenge
            if resp.status_code in (403, 429) or 'cf-mitigated' in resp.headers or 'Attention Required! | Cloudflare' in resp.text:
                self.is_blocked_by_cloudflare = True
                res['crawl_error'] = f"Automated access restricted (HTTP {resp.status_code} / Bot Challenge)"
                return res

            if resp.status_code >= 400:
                res['crawl_error'] = f"Server returned HTTP status {resp.status_code}"
                return res

            # Parse content with BeautifulSoup
            soup = BeautifulSoup(resp.content, 'html.parser')
            res['is_accessible'] = True

            # Extract title and meta description
            title_tag = soup.find('title')
            res['title'] = title_tag.string.strip() if title_tag and title_tag.string else ""
            desc_tag = soup.find('meta', attrs={'name': 'description'}) or soup.find('meta', attrs={'property': 'og:description'})
            if desc_tag and desc_tag.get('content'):
                res['meta_description'] = desc_tag['content'].strip()

            # Social links
            for a in soup.find_all('a', href=True):
                h = a['href'].strip()
                if 'linkedin.com' in h and 'linkedin' not in res['social_links']:
                    res['social_links']['linkedin'] = h
                elif ('twitter.com' in h or 'x.com' in h) and 'twitter' not in res['social_links']:
                    res['social_links']['twitter'] = h
                elif 'facebook.com' in h and 'facebook' not in res['social_links']:
                    res['social_links']['facebook'] = h

            # Technologies
            res['technologies'] = self.detect_technologies(resp.text, dict(resp.headers))
            res['has_chat'] = any(t in ['Intercom', 'Drift', 'Zendesk', 'Tidio', 'HubSpot Chat', 'Freshdesk'] for t in res['technologies'])

            # Collect internal links for discovery
            internal_links = []
            for a in soup.find_all('a', href=True):
                href = a['href'].strip()
                if href.startswith('#') or href.startswith('javascript:'):
                    continue
                full_link = urllib.parse.urljoin(clean_url, href)
                if self.is_same_domain(full_link):
                    internal_links.append(self.strip_tracking_params(full_link))
            res['outbound_internal_links'] = list(set(internal_links))

            # Strip non-informational elements (scripts, styles, nav, footer)
            for el in soup(['script', 'style', 'noscript', 'svg', 'iframe', 'canvas']):
                el.decompose()

            # Extract textual sentences for evidence citation
            text_blocks = []
            for tag in soup.find_all(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'span', 'div']):
                txt = tag.get_text(separator=' ', strip=True)
                if len(txt) > 20 and not re.search(r'cookie|privacy policy|terms of service|copyright', txt, re.I):
                    text_blocks.append(txt)

            combined_text = ' '.join(text_blocks)
            # Remove duplicate whitespace
            cleaned_text = re.sub(r'\s+', ' ', combined_text).strip()
            res['text'] = cleaned_text[:MAX_PAGE_TEXT_LENGTH]
            res['word_count'] = len(cleaned_text.split())

            # Split into clean distinct sentences for evidence matching
            raw_sentences = re.split(r'(?<=[.!?])\s+', cleaned_text)
            res['sentences'] = [s.strip() for s in raw_sentences if len(s.strip()) > 25 and len(s.strip()) < 400][:100]

            return res

        except requests.exceptions.Timeout:
            res['crawl_error'] = f"Connection timed out after {DEFAULT_TIMEOUT}s"
            return res
        except requests.exceptions.SSLError:
            res['crawl_error'] = "SSL Certificate verification failed on target domain"
            return res
        except requests.exceptions.ConnectionError:
            res['crawl_error'] = "Failed to establish DNS or TCP connection to target server"
            return res
        except Exception as e:
            res['crawl_error'] = f"Crawler error: {str(e)}"
            return res

    def investigate_company_site(self) -> Dict[str, Any]:
        """
        Executes the full controlled company website investigation:
        1. Checks domain correspondence
        2. Inspects robots.txt
        3. Investigates Homepage
        4. Discovers URLs via Sitemap.xml and Homepage links
        5. Prioritizes and investigates top business pages (About, Products, Services, Careers, Contact)
        6. Aggregates technologies, performance metrics, and research coverage statistics.
        """
        correspondence_match, correspondence_conf, correspondence_reason = self.verify_company_domain_match()
        
        coverage = {
            'target_url': self.normalized_url,
            'canonical_domain': self.canonical_domain,
            'correspondence_match': correspondence_match,
            'correspondence_confidence': correspondence_conf,
            'correspondence_reason': correspondence_reason,
            'pages_discovered': 0,
            'pages_investigated': 0,
            'pages_inaccessible': 0,
            'pages_skipped': 0,
            'technologies_found': [],
            'social_profiles': {},
            'issues': [],
            'has_ssl': self.normalized_url.startswith('https://'),
            'is_accessible': False,
        }

        investigated_pages: List[Dict[str, Any]] = []
        all_tech: Set[str] = set()

        if not self.normalized_url:
            coverage['issues'].append("No website URL provided.")
            return {
                'coverage': coverage,
                'pages': [],
                'all_sentences': [],
                'technologies': []
            }

        # Step A: Check robots.txt
        self.check_robots_txt()

        # Step B: Crawl Homepage
        self.discovered_urls.add(self.normalized_url)
        homepage_data = self.fetch_page(self.normalized_url, discovery_method="HOMEPAGE")
        self.crawled_urls.add(self.normalized_url)

        if not homepage_data.get('is_accessible'):
            err = homepage_data.get('crawl_error') or "Homepage could not be loaded."
            coverage['issues'].append(err)
            coverage['pages_inaccessible'] += 1
            return {
                'coverage': coverage,
                'pages': [{
                    'page_type': 'HOMEPAGE',
                    'url': self.normalized_url,
                    'title': '',
                    'status_code': homepage_data.get('status_code', 0),
                    'is_accessible': False,
                    'crawl_error': err,
                    'content_snippet': '',
                    'technologies': []
                }],
                'all_sentences': [],
                'technologies': []
            }

        coverage['is_accessible'] = True
        coverage['pages_investigated'] += 1
        all_tech.update(homepage_data['technologies'])
        coverage['social_profiles'].update(homepage_data.get('social_links', {}))

        homepage_data['page_type'] = 'HOMEPAGE'
        investigated_pages.append(homepage_data)

        # Step C: Discover Candidates from Sitemap & Homepage Links
        candidate_map: Dict[str, Tuple[str, str]] = {}  # category -> (url, discovery_source)

        # 1. Sitemap
        sitemap_candidates = self.discover_sitemap_urls()
        for cat, s_url in sitemap_candidates:
            if cat not in candidate_map and s_url not in self.crawled_urls:
                candidate_map[cat] = (s_url, "SITEMAP")
                self.discovered_urls.add(s_url)

        # 2. Homepage internal links
        for link in homepage_data.get('outbound_internal_links', []):
            self.discovered_urls.add(link)
            cat = self.classify_url_category(link)
            if cat != 'OTHER' and cat not in candidate_map and link not in self.crawled_urls:
                candidate_map[cat] = (link, "HOMEPAGE_NAV")

        coverage['pages_discovered'] = len(self.discovered_urls)

        # Step D: Prioritize pages to crawl in optimal business intelligence order
        priority_order = [
            'ABOUT', 'SERVICES', 'PRODUCTS', 'SOLUTIONS',
            'INDUSTRIES', 'CASE_STUDIES', 'CAREERS', 'TECHNOLOGY',
            'CONTACT', 'PRICING', 'OVERVIEW', 'NEWS'
        ]

        pages_to_crawl = []
        for p_cat in priority_order:
            if p_cat in candidate_map:
                pages_to_crawl.append((p_cat, candidate_map[p_cat][0], candidate_map[p_cat][1]))
                if len(pages_to_crawl) >= (MAX_PAGES_TO_CRAWL - 1):
                    break

        coverage['pages_skipped'] = max(0, len(self.discovered_urls) - len(pages_to_crawl) - 1)

        # Step E: Fetch prioritized pages
        for p_cat, p_url, method in pages_to_crawl:
            if p_url in self.crawled_urls:
                continue
            self.crawled_urls.add(p_url)

            sub_page = self.fetch_page(p_url, discovery_method=method)
            sub_page['page_type'] = p_cat

            if sub_page.get('is_accessible'):
                coverage['pages_investigated'] += 1
                all_tech.update(sub_page['technologies'])
                coverage['social_profiles'].update(sub_page.get('social_links', {}))
                investigated_pages.append(sub_page)
            else:
                coverage['pages_inaccessible'] += 1
                coverage['issues'].append(f"Could not access {p_cat} page ({p_url}): {sub_page.get('crawl_error')}")
                investigated_pages.append(sub_page)

        coverage['technologies_found'] = sorted(list(all_tech))

        # Flatten all sentences across all crawled pages for the evidence verification engine
        all_sentences: List[Dict[str, Any]] = []
        for p in investigated_pages:
            if p.get('is_accessible'):
                for s in p.get('sentences', []):
                    all_sentences.append({
                        'sentence': s,
                        'source_url': p['url'],
                        'page_title': p['title'],
                        'page_type': p.get('page_type', 'OTHER')
                    })

        return {
            'coverage': coverage,
            'pages': investigated_pages,
            'all_sentences': all_sentences,
            'technologies': sorted(list(all_tech))
        }
