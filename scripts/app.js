document.addEventListener('DOMContentLoaded', function() {
    // Core Configuration
    const config = {
        maxImageSize: 2 * 1024 * 1024, // 2MB
        allowedImageTypes: ['image/jpeg', 'image/png']
    };
  
    // Dark Mode Initialization
    const darkModeToggle = document.getElementById('darkModeToggle');
    const icon = darkModeToggle?.querySelector('i');
    
    // Supabase Client (Make sure you added this in HTML head)
    // Supabase Client 
const SUPABASE_URL = 'https://zlgdklqjaomnlfteairf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsZ2RrbHFqYW9tbmxmdGVhaXJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQwNjMxODQsImV4cCI6MjA1OTYzOTE4NH0.UlpTet57p8RZcmJ5ULf2TCFVG_rTubx7rLHRTHRFRn8';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    // Service Worker Registration
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(() => console.log('Service Worker Registered'))
            .catch(err => console.log('Service Worker Error:', err));
    }
  
    // Dark Mode Functions
    function initializeDarkMode() {
        if (localStorage.getItem('darkMode') === 'light') {
            document.body.classList.add('light-mode');
            icon?.classList.replace('fa-moon', 'fa-sun');
        }
    }
  
    function toggleDarkMode() {
        document.body.classList.toggle('light-mode');
        localStorage.setItem('darkMode', 
            document.body.classList.contains('light-mode') ? 'light' : 'dark'
        );
        icon?.classList.toggle('fa-moon');
        icon?.classList.toggle('fa-sun');
    }
  
    // Article Management
    function createArticleCard(article) {
        const safeContent = DOMPurify.sanitize(article.content.substring(0, 100));
        
        return `
            <div class="article-card" data-id="${article.id}">
                ${article.image ? `<img src="${article.image}" class="article-image" alt="Take image">` : ''}
                ${article.xPostLink ? `<blockquote class="twitter-tweet"><a href="${DOMPurify.sanitize(article.xPostLink)}"></a></blockquote>` : ''}
                <div class="article-content">
                    <h3>${DOMPurify.sanitize(article.title)}</h3>
                    <p>${safeContent}...</p>
                    <div class="article-meta">
                        <span>${DOMPurify.sanitize(article.author)}</span>
                        <span>${new Date(article.created_at).toLocaleDateString()}</span>
                    </div>
                    <div class="hot-take-meter" data-article-id="${article.id}">
                        <div class="score-bar" style="width: ${article.hotTakeScore}%"></div>
                        <span class="hot-take-score">${article.hotTakeScore}%</span>
                    </div>
                    <button class="btn share-btn" onclick="shareArticle(${article.id})">📢 Share</button>
                </div>
            </div>
        `;
    }
  
    // Voting System
    async function handleVote(articleId) {
        const { data: article, error } = await supabase
            .from('articles')
            .select('hotTakeScore')
            .eq('id', articleId)
            .single();

        if (!error) {
            const newScore = Math.min(article.hotTakeScore + 20, 100);
            const { error: updateError } = await supabase
                .from('articles')
                .update({ hotTakeScore: newScore })
                .eq('id', articleId);

            if (!updateError) loadArticles();
        }
    }
  
    // Article Loading System
    async function loadArticles() {
        const { data: articles, error } = await supabase
            .from('articles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) return;

        const hotTakesContainer = document.getElementById('hotTakes');
        const classicTakesContainer = document.getElementById('classicTakes');
        const searchResultsContainer = document.getElementById('searchResults');

        [hotTakesContainer, classicTakesContainer, searchResultsContainer].forEach(container => {
            if (container) container.innerHTML = '';
        });

        articles.forEach(article => {
            const card = createArticleCard(article);
            const targetContainer = article.hotTakeScore >= 75 ? 
                classicTakesContainer : 
                hotTakesContainer;
            
            if (targetContainer) targetContainer.insertAdjacentHTML('beforeend', card);
        });

        // Update empty states
        document.getElementById('hotTakesEmpty').style.display = 
            hotTakesContainer?.children.length ? 'none' : 'block';
        document.getElementById('classicTakesEmpty').style.display = 
            classicTakesContainer?.children.length ? 'none' : 'block';

        // Add voting handlers
        document.querySelectorAll('.hot-take-meter').forEach(meter => {
            meter.addEventListener('click', function() {
                handleVote(Number(this.dataset.articleId));
            });
        });

        // Load Twitter widgets
        if (typeof twttr !== 'undefined') twttr.widgets.load();
    }
  
    // Search Functionality
    async function performSearch() {
        const searchTerm = this.value.toLowerCase();
        const { data: articles } = await supabase
            .from('articles')
            .select('*');

        const filtered = articles.filter(article => 
            article.title.toLowerCase().includes(searchTerm) ||
            article.content.toLowerCase().includes(searchTerm)
        );
        
        const container = document.getElementById('searchResults');
        if (container) {
            container.innerHTML = filtered.map(createArticleCard).join('');
            document.getElementById('noResults').style.display = 
                filtered.length ? 'none' : 'block';
        }
    }
  
    // Form Handling
    async function handleFormSubmit(e) {
        e.preventDefault();
        
        if (!e.target.checkValidity()) {
            e.target.reportValidity();
            return;
        }

        const newArticle = {
            title: DOMPurify.sanitize(document.getElementById('takeTitle').value),
            author: DOMPurify.sanitize(document.getElementById('takeName').value),
            content: DOMPurify.sanitize(document.getElementById('takeContent').value),
            xPostLink: DOMPurify.sanitize(document.getElementById('xPostLink').value),
            image: localStorage.getItem('tempImage') || '',
            hotTakeScore: 0
        };

        const { error } = await supabase
            .from('articles')
            .insert([newArticle]);

        if (!error) {
            showToast('Take launched! 🚀');
            e.target.reset();
            localStorage.removeItem('tempImage');
            document.querySelector('.image-preview-container').innerHTML = '';
        }
    }
  
    // Helper Functions
    function showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.remove('toast-hidden');
        setTimeout(() => toast.classList.add('toast-hidden'), 3000);
    }
  
    // Image Upload Handler
    function handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!config.allowedImageTypes.includes(file.type)) {
            alert('Only JPG/PNG images allowed!');
            return;
        }

        if (file.size > config.maxImageSize) {
            alert('Image too large! Max 2MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            localStorage.setItem('tempImage', event.target.result);
            document.querySelector('.image-preview-container').innerHTML = `
                <img src="${event.target.result}" class="image-preview">
                <button class="remove-image" onclick="this.parentElement.innerHTML = ''">×</button>
            `;
        };
        reader.readAsDataURL(file);
    }
  
    // Character Counter
    function updateCharCount() {
        const counter = document.getElementById('charCount');
        counter.textContent = `${this.value.length}/500`;
    }
  
    // Initialization
    function initializeApp() {
        initializeDarkMode();
        
        // Real-time Updates
        supabase
            .channel('articles')
            .on('postgres_changes', { event: '*', schema: 'public' }, () => loadArticles())
            .subscribe();

        // Event Listeners
        darkModeToggle?.addEventListener('click', toggleDarkMode);
        document.getElementById('searchInput')?.addEventListener('input', performSearch);
        document.getElementById('globalSearch')?.addEventListener('input', performSearch);
        document.querySelector('.take-form')?.addEventListener('submit', handleFormSubmit);
        document.getElementById('takeImage')?.addEventListener('change', handleImageUpload);
        document.getElementById('takeContent')?.addEventListener('input', updateCharCount);

        // Initial Load
        loadArticles();
    }
  
    // Start the App
    initializeApp();
});
