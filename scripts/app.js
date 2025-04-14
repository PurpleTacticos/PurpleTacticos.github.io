// scripts/app.js
document.addEventListener('DOMContentLoaded', function() {

// Configuration
const config = {
  maxImageSize: 2 * 1024 * 1024,
  allowedImageTypes: ['image/jpeg', 'image/png']
};

// Supabase Client
const SUPABASE_URL = 'https://zlgdklqjaomnlfteairf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsZ2RrbHFqYW9tbmxmdGVhaXJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQwNjMxODQsImV4cCI6MjA1OTYzOTE4NH0.UlpTet57p8RZcmJ5ULf2TCFVG_rTubx7rLHRTHRFRn8';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// State Management
let votedArticles = JSON.parse(localStorage.getItem('voted')) || [];

// Dark Mode
const darkModeToggle = document.getElementById('darkModeToggle');
const icon = darkModeToggle?.querySelector('i');

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

// DOM Elements
const articlesContainer = document.getElementById('articles');
const emptyState = document.getElementById('emptyState');
const toast = document.getElementById('toast');
const loadingSpinner = document.getElementById('loading');
const takeForm = document.getElementById('takeForm');
const imageInput = document.getElementById('image');
const imagePreview = document.getElementById('imagePreview');
const removeImageButton = document.getElementById('removeImage');

// --- UTILITY FUNCTIONS ---
function showToast(message) {
    toast.textContent = message;
    toast.classList.remove('toast-hidden');
    setTimeout(() => {
        toast.classList.add('toast-hidden');
    }, 3000);
}

function showLoading() {
    loadingSpinner.style.display = 'block';
}

function hideLoading() {
    loadingSpinner.style.display = 'none';
}

// --- ARTICLE CARD CREATION ---
function createArticleCard(article) {
    const safeTitle = DOMPurify.sanitize(article.title);
    const safeContent = DOMPurify.sanitize(article.content);

    return `
        <div class="article-card">
            <img src="${article.image_url || '/images/default-image.jpg'}" alt="Article Image" class="article-image">
            <div class="article-content">
                <h3 class="article-title">${safeTitle}</h3>
                <p class="article-excerpt">${safeContent.length > 100 ? safeContent.substring(0, 100) + '...' : safeContent}</p>
                <div class="article-meta">
                    <span>Published: ${new Date(article.created_at).toLocaleDateString()}</span>
                    <span>Comments: ${article.commentCount || 0}</span>
                </div>
            </div>

            <div class="vote-container">
                <div class="meter hot-meter ${votedArticles.includes(article.id) ? 'voted' : ''}"
                     onclick="voteArticle(${article.id}, 'hot')"
                     title="${votedArticles.includes(article.id) ? 'You already voted!' : 'Vote Hot'}">
                    <span class="score-bar" style="width: ${article.hotMeter}%"></span>
                    <span class="score">${article.hotMeter}%</span>
                </div>
                <div class="meter trash-meter ${votedArticles.includes(article.id) ? 'voted' : ''}"
                     onclick="voteArticle(${article.id}, 'trash')"
                     title="${votedArticles.includes(article.id) ? 'You already voted!' : 'Vote Trash'}">
                    <span class="score-bar" style="width: ${article.trashMeter}%"></span>
                    <span class="score">${article.trashMeter}%</span>
                </div>
            </div>

            <section class="comments-section">
                <form class="comment-form" onsubmit="event.preventDefault(); submitComment(${article.id})">
                    <input type="text" id="commentInput-${article.id}" placeholder="Add a comment..." required>
                    <button type="submit">Comment</button>
                </form>
                <div class="comments-container" id="comments-${article.id}">
                    <!-- Comments will be loaded here -->
                </div>
            </section>
        </div>
    `;
}

// --- LOAD ARTICLES ---
async function loadArticles() {
    showLoading();
    emptyState.style.display = 'none';
    articlesContainer.innerHTML = '';

    const { data: articles, error } = await supabase
        .from('takes')
        .select(`
            id,
            created_at,
            title,
            content,
            image_url,
            hotMeter,
            trashMeter,
            commentCount,
            comments (
                id,
                created_at,
                content,
                article_id
            )
        `)
        .order('created_at', { ascending: false });

    hideLoading();

    if (error) {
        console.error("Error loading articles:", error);
        showToast('Failed to load articles.');
        emptyState.style.display = 'block';
        return;
    }

    if (articles.length === 0) {
        emptyState.style.display = 'block';
        return;
    }

    articles.forEach(article => {
        articlesContainer.innerHTML += createArticleCard(article);
        loadComments(article.id);
    });
}

// --- VOTE ARTICLE ---
async function voteArticle(articleId, voteType) {
    if (votedArticles.includes(articleId)) {
        showToast('You have already voted on this article.');
        return;
    }

    const isHot = voteType === 'hot';

    const { data, error } = await supabase
        .rpc('vote', {
            article_id: articleId,
            is_hot: isHot
        });

    if (error) {
        console.error("Voting error:", error);
        showToast('Voting failed. Please try again.');
        return;
    }

    votedArticles.push(articleId);
    localStorage.setItem('voted', JSON.stringify(votedArticles));
    showToast(`You voted this take as ${voteType}!`);
    loadArticles();
}

// --- SUBMIT COMMENT ---
async function submitComment(articleId) {
    const commentInput = document.getElementById(`commentInput-${articleId}`);
    const commentText = commentInput.value.trim();

    if (!commentText) {
        showToast('Comment cannot be empty.');
        return;
    }

    const { data, error } = await supabase
        .from('comments')
        .insert([{
            content: commentText,
            article_id: articleId
        }])
        .select('*');

    if (error) {
        console.error("Error submitting comment:", error);
        showToast('Failed to submit comment.');
        return;
    }

    commentInput.value = ''; // Clear the input field
    showToast('Comment submitted successfully!');
    loadComments(articleId);
    loadArticles();
}

// --- LOAD COMMENTS ---
async function loadComments(articleId) {
    const commentsContainer = document.getElementById(`comments-${articleId}`);
    commentsContainer.innerHTML = '';

    const { data: comments, error } = await supabase
        .from('comments')
        .select('*')
        .eq('article_id', articleId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error loading comments:", error);
        commentsContainer.innerHTML = '<p>Failed to load comments.</p>';
        return;
    }

    if (comments && comments.length > 0) {
        comments.forEach(comment => {
            const commentDiv = document.createElement('div');
            commentDiv.className = 'comment';
            commentDiv.innerHTML = `
                <div class="comment-header">
                    <span class="comment-author">Anonymous</span>
                    <span class="comment-date">${new Date(comment.created_at).toLocaleDateString()}</span>
                </div>
                <p class="comment-content">${DOMPurify.sanitize(comment.content)}</p>
            `;
            commentsContainer.appendChild(commentDiv);
        });
    } else {
        commentsContainer.innerHTML = '<p>No comments yet. Be the first to comment!</p>';
    }
}

// --- HANDLE IMAGE INPUT ---
imageInput?.addEventListener('change', function() {
    const file = this.files[0];

    if (!file) {
        imagePreview.src = "";
        imagePreview.parentElement.style.display = 'none';
        return;
    }

    if (file.size > config.maxImageSize) {
        alert("Image size exceeds the maximum limit of 2MB.");
        this.value = '';
        imagePreview.src = "";
        imagePreview.parentElement.style.display = 'none';
        return;
    }

    if (!config.allowedImageTypes.includes(file.type)) {
        alert("Invalid image format. Only JPEG and PNG are allowed.");
        this.value = '';
        imagePreview.src = "";
        imagePreview.parentElement.style.display = 'none';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        imagePreview.src = e.target.result;
        imagePreview.parentElement.style.display = 'block';
    }
    reader.readAsDataURL(file);
});

// --- REMOVE IMAGE ---
removeImageButton?.addEventListener('click', function() {
    imageInput.value = '';
    imagePreview.src = "";
    imagePreview.parentElement.style.display = 'none';
});

// --- SUBMIT TAKE FORM ---
takeForm?.addEventListener('submit', async function(event) {
    event.preventDefault();

    const title = document.getElementById('title').value.trim();
    const content = document.getElementById('content').value.trim();
    const imageFile = imageInput.files[0];

    if (!title || !content) {
        showToast('Title and content cannot be empty.');
        return;
    }

    showLoading();

    let imageUrl = null;
    if (imageFile) {
        const timestamp = new Date().getTime();
        const imageName = `take_image_${timestamp}.${imageFile.name.split('.').pop()}`;

        const { data, error: uploadError } = await supabase
            .storage
            .from('take_images')
            .upload(imageName, imageFile, {
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) {
            hideLoading();
            console.error("Image upload error:", uploadError);
            showToast('Failed to upload image.');
            return;
        }

        imageUrl = `${SUPABASE_URL}/storage/v1/object/public/take_images/${imageName}`;
    }

    const { data, error } = await supabase
        .from('takes')
        .insert([{
            title: title,
            content: content,
            image_url: imageUrl
        }])
        .select('*');

    hideLoading();

    if (error) {
        console.error("Error submitting take:", error);
        showToast('Failed to submit take.');
        return;
    }

    document.getElementById('title').value = '';
    document.getElementById('content').value = '';
    imageInput.value = '';
    imagePreview.src = "";
    imagePreview.parentElement.style.display = 'none';

    showToast('Take submitted successfully!');
    loadArticles();
});

// Search Functionality
document.querySelector('#searchButton')?.addEventListener('click', function() {
  const query = document.querySelector('#searchInput').value.trim();
  if (query) {
    window.location.href = `/search-results.html?query=${encodeURIComponent(query)}`;
  }
});

// Game Modal Functionality
function playGame(gameUrl) {
  const modal = document.getElementById('gameModal');
  const iframe = document.getElementById('gameFrame');
  iframe.src = gameUrl;
  modal.style.display = 'block';
}

function closeModal() {
  const modal = document.getElementById('gameModal');
  const iframe = document.getElementById('gameFrame');
  iframe.src = '';
  modal.style.display = 'none';
}

// Trending Takes Functionality
async function loadTrendingTakes() {
  const { data: trendingTakes, error } = await supabase
    .from('takes')
    .select('*')
    .order('hotMeter', { ascending: false })
    .limit(10);

  if (!error) {
    const container = document.getElementById('trendingTakes');
    container.innerHTML = '';

    trendingTakes.forEach(take => {
      const takeCard = document.createElement('div');
      takeCard.className = 'article-card';
      takeCard.innerHTML = `
        <h3>${DOMPurify.sanitize(take.title)}</h3>
        <p>${DOMPurify.sanitize(take.content)}</p>
        <div class="game-stats">
          <span><i class="fas fa-fire"></i> ${take.hotMeter}</span>
          <span><i class="fas fa-comments"></i> ${take.commentCount || 0}</span>
        </div>
      `;
      container.appendChild(takeCard);
    });
  }
}
// Initialize Page-Specific Functions
document.addEventListener('DOMContentLoaded', function() {
  initializeDarkMode();

  // Search Results Page
  if (window.location.pathname.includes('search-results')) {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('query');
    document.getElementById('results').innerHTML = `Searching for "${query}"...`;
  }

  // Trending Page
  if (window.location.pathname.includes('trending')) {
    loadTrendingTakes();
  }

  // Games Page Modal Closing
  document.querySelector('.close-modal')?.addEventListener('click', closeModal);
  window.onclick = function(event) {
    if (event.target == document.getElementById('gameModal')) {
      closeModal();
    }
  }
});
// Load articles on initial load
loadArticles();
});
