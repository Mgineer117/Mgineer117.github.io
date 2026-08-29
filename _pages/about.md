---
layout: home
title: "MJ (Minjae) Cho"
permalink: /
redirect_from:
  - /about/
  - /about.html
---

{% include base_path %}

{% assign all_tags = "" | split: "," %}
{% for post in site.publications %}{% if post.tags %}{% for tag in post.tags %}{% assign all_tags = all_tags | push: tag %}{% endfor %}{% endif %}{% endfor %}
{% assign unique_tags = all_tags | uniq | sort %}
{% assign sorted_pubs = site.publications | sort: "date" | reverse %}

<!-- ============================ 01 · RESEARCH ============================ -->
<section class="sec">
  <div class="wrap">

    <div class="sec-head reveal">
      <p class="eyebrow">01 &mdash; Research</p>
      <h2>RL-based control, held to a control-theoretic standard</h2>
      <p class="sec-sub">
        My research aims at developing <strong>robust robotic autonomy</strong> at the intersection of
        <strong>reinforcement learning (RL)</strong> and <strong>control theory</strong>. Three threads run
        through it, and each one is a paper you can read below.
      </p>
    </div>

    <div class="focus-grid reveal">

      <div class="focus-card">
        <p class="focus-card__n">01</p>
        <h3>Stability that follows from convergence</h3>
        <p>
          Certifying a highly nonlinear system usually means synthesising a certificate by hand, on a
          control-affine model most robots never actually admit. Learning the contraction metric and the
          policy together turns that certification problem into a convergence problem instead.
        </p>
        <div class="focus-card__links">
          <a href="{{ base_path }}/publication/2025-05-28-CAC">CARL &middot; T-RO</a>
        </div>
      </div>

      <div class="focus-card">
        <p class="focus-card__n">02</p>
        <h3>Constraints that survive the task change</h3>
        <p>
          A cost bound that only holds on the training distribution is not much of a bound. I work on
          adapting constrained policies to unseen tasks, and on reading the gaps in offline data as a
          reason to be more conservative rather than less.
        </p>
        <div class="focus-card__links">
          <a href="{{ base_path }}/publication/2024-03-24-META_CPO">Meta-CPO &middot; AAAI</a>
          <a href="{{ base_path }}/publication/2026-02-28-Sparsity">Sparsity &middot; AIAA</a>
          <a href="{{ base_path }}/publication/2025-11-30-MOOD_CRL">MOOD-CRL</a>
        </div>
      </div>

      <div class="focus-card">
        <p class="focus-card__n">03</p>
        <h3>Structure for long horizons</h3>
        <p>
          Sparse rewards and long task horizons break flat policies. Discovering macro-actions
          automatically &mdash; and shaping an intrinsic signal where the extrinsic one is silent &mdash;
          keeps credit assignment tractable as the horizon grows.
        </p>
        <div class="focus-card__links">
          <a href="{{ base_path }}/publication/2024-12-16-HIMETA">HiMeta &middot; Sci. Reports</a>
          <a href="{{ base_path }}/publication/2026-01-30-IRPO">IRPO</a>
        </div>
      </div>

    </div>
  </div>
</section>

<!-- ============================ 02 · IN MOTION =========================== -->
<section class="sec sec--tint">
  <div class="wrap">

    <div class="sec-head reveal">
      <p class="eyebrow">02 &mdash; In motion</p>
      <h2>What the policies actually do</h2>
      <p class="sec-sub">
        Recorded from the experiments in the papers. Clips load only when you ask for them &mdash;
        tap one to play.
      </p>
    </div>

    <div class="reel reveal">

      <div class="reel-item">
        <button class="reel-stage" type="button" aria-pressed="false"
                aria-label="Play the CARL tracking clip"
                data-clip="{{ base_path }}/files/CAC/carl.gif">
          <img src="{{ base_path }}/files/CAC/carl-poster.jpg" alt="CARL path-tracking rollout" loading="lazy" decoding="async">
          <span class="reel-stage__size">GIF &middot; 4.9 MB</span>
          <span class="reel-stage__play"><span>&#9654;</span></span>
        </button>
        <div class="reel-body">
          <h3><a href="{{ base_path }}/publication/2025-05-28-CAC">Contraction-Aware RL</a></h3>
          <p>Perturbed rollouts pulled back onto the reference trajectory by a jointly learned contraction metric.</p>
          <span class="reel-venue">IEEE Transactions on Robotics</span>
        </div>
      </div>

      <div class="reel-item">
        <button class="reel-stage" type="button" aria-pressed="false"
                aria-label="Play the HiMeta clip"
                data-clip="{{ base_path }}/files/HIMETA/himeta.gif">
          <img src="{{ base_path }}/files/HIMETA/himeta-poster.jpg" alt="HiMeta MetaWorld rollout" loading="lazy" decoding="async">
          <span class="reel-stage__size">GIF &middot; 4.1 MB</span>
          <span class="reel-stage__play"><span>&#9654;</span></span>
        </button>
        <div class="reel-body">
          <h3><a href="{{ base_path }}/publication/2024-12-16-HIMETA">HiMeta</a></h3>
          <p>Macro-actions discovered without supervision, then reused by a hierarchy on unseen manipulation tasks.</p>
          <span class="reel-venue">Scientific Reports</span>
        </div>
      </div>

      <div class="reel-item">
        <button class="reel-stage" type="button" aria-pressed="false"
                aria-label="Play the Meta-CPO clip"
                data-clip="{{ base_path }}/files/META_CPO/Meta_CPO.gif">
          <img src="{{ base_path }}/files/META_CPO/Meta_CPO-poster.jpg" alt="Meta-CPO constrained navigation rollout" loading="lazy" decoding="async">
          <span class="reel-stage__size">GIF &middot; 2.4 MB</span>
          <span class="reel-stage__play"><span>&#9654;</span></span>
        </button>
        <div class="reel-body">
          <h3><a href="{{ base_path }}/publication/2024-03-24-META_CPO">Meta-CPO</a></h3>
          <p>Constraint satisfaction carried into a task the agent was never trained on, with only a few adaptation steps.</p>
          <span class="reel-venue">AAAI 2024</span>
        </div>
      </div>

    </div>
  </div>
</section>

<!-- ========================== 03 · SELECTED WORK ========================= -->
<section class="sec" id="work">
  <div class="wrap">

    <div class="sec-head reveal">
      <p class="eyebrow">03 &mdash; Selected work</p>
      <h2>Papers</h2>
      <p class="sec-sub">Filter by topic, or open a paper for the full write-up, figures, and citation.</p>
    </div>

    <div data-filter-root data-filter-items=".work-card">
    <div class="filters reveal">
      <button class="filter-btn is-active" type="button" data-tag="all">All</button>
      {% for tag in unique_tags %}<button class="filter-btn" type="button" data-tag="{{ tag }}">{{ tag }}</button>
      {% endfor %}
    </div>

    <div class="work-grid reveal">
      {% for post in sorted_pubs %}
      {% assign poster = post.teaser | replace: '.gif', '-poster.jpg' %}
      <a class="work-card" href="{{ base_path }}{{ post.url }}"
         data-tags="{% for tag in post.tags %}{{ tag }}{% unless forloop.last %},{% endunless %}{% endfor %}">
        <div class="work-card__media">
          <img src="{{ base_path }}{{ poster }}" alt="" loading="lazy" decoding="async">
        </div>
        <div class="work-card__body">
          <div class="work-card__venue">{{ post.date | date: "%Y" }} &middot; {{ post.venue | truncate: 42 }}</div>
          <div class="work-card__title">{{ post.title }}</div>
          <div class="work-card__desc">{{ post.excerpt | strip_html | truncate: 132 }}</div>
          <div class="work-card__tags">{% for tag in post.tags %}<span class="chip">{{ tag }}</span>{% endfor %}</div>
        </div>
      </a>
      {% endfor %}
    </div>
    </div>

    <p style="margin-top: 30px; display: flex; flex-wrap: wrap; gap: 12px;">
      <a class="btn-x btn-x--ghost btn-x--sm" href="{{ base_path }}/publications/">All publications &rarr;</a>
      <a class="btn-x btn-x--ghost btn-x--sm" href="{{ base_path }}/projects/">Earlier projects &rarr;</a>
    </p>

  </div>
</section>

<!-- =========================== 04 · BACKGROUND =========================== -->
<section class="sec sec--tint">
  <div class="wrap">

    <div class="sec-head reveal">
      <p class="eyebrow">04 &mdash; Background</p>
      <h2>Where I've been</h2>
    </div>

    <div class="tl reveal">
      <div class="tl-row tl-row--now">
        <span class="tl-dot" aria-hidden="true"></span>
        <span class="tl-when">2024.07 &ndash; Present</span>
        <span class="tl-logo"><img src="{{ base_path }}/files/UIUC_logo.png" alt="University of Illinois Urbana-Champaign" loading="lazy"></span>
        <div class="tl-what">
          <h3>Ph.D. Student</h3>
          <p><b>University of Illinois Urbana-Champaign</b> &mdash; Aerospace Engineering (Control and Dynamical Systems)</p>
        </div>
      </div>
      <div class="tl-row">
        <span class="tl-dot" aria-hidden="true"></span>
        <span class="tl-when">2019.08 &ndash; 2024.06</span>
        <span class="tl-logo"><img src="{{ base_path }}/files/Msstate_logo.png" alt="Mississippi State University" loading="lazy"></span>
        <div class="tl-what">
          <h3>B.S., Mechanical Engineering</h3>
          <p><b>Mississippi State University</b> &mdash; Minor in Applied Mathematics</p>
        </div>
      </div>
    </div>

    <div class="reveal" style="margin-top: 44px;">
      <p class="eyebrow" style="margin-bottom: 16px;">Collaborators</p>
      <div class="people">
        <a href="https://hirotsukamoto.com/" target="_blank" rel="noopener">Hiroyasu Tsukamoto <small>UIUC</small></a>
        <a href="https://sites.google.com/view/sun-research-lab/people?authuser=0" target="_blank" rel="noopener">Chuangchuang Sun <small>Villanova</small></a>
        <a href="https://acl.mit.edu/people" target="_blank" rel="noopener">Jonathan P. How <small>MIT</small></a>
        <a href="https://www.math.msstate.edu/directory/skim" target="_blank" rel="noopener">Seongjai Kim <small>Mississippi State</small></a>
        <a href="https://ftpl.kaist.ac.kr/People" target="_blank" rel="noopener">Joonsik Hwang <small>KAIST</small></a>
        <a href="https://www.cavs.msstate.edu/directory/information.php?d=1983" target="_blank" rel="noopener">Seongkwang Mun <small>Mississippi State</small></a>
      </div>
    </div>

  </div>
</section>

<!-- ============================== 05 · NEWS ============================== -->
<section class="sec">
  <div class="wrap">

    <div class="sec-head reveal">
      <p class="eyebrow">05 &mdash; Recent</p>
      <h2>News</h2>
    </div>

    <div class="news reveal" id="news-list">

      <div class="news-row">
        <span class="news-when">Aug 2026</span>
        <span class="news-kind" data-kind="paper">Paper</span>
        <div class="news-what"><em>&ldquo;Contraction-Aware Reinforcement Learning for Nonlinear Control with Statistical Robustness&rdquo;</em> accepted to <b>IEEE Transactions on Robotics</b>.</div>
      </div>

      <div class="news-row">
        <span class="news-when">Jun 2026</span>
        <span class="news-kind" data-kind="talk">Talk</span>
        <div class="news-what">Presenting <em>&ldquo;Sparsity-based Safety Conservatism&rdquo;</em> at the <b>AIAA AVIATION Forum</b>.</div>
      </div>

      <div class="news-row">
        <span class="news-when">2026</span>
        <span class="news-kind" data-kind="grant">Grant</span>
        <div class="news-what"><b>NSF ACCESS Discover Allocation</b> (Role: PI) for <em>&ldquo;Synthesis of Optimal and Contracting Policies for Safety-Critical Nonlinear Control&rdquo;</em> &mdash; 750,000 compute credits (est. value $12,000).</div>
      </div>

      <div class="news-row">
        <span class="news-when">2026</span>
        <span class="news-kind" data-kind="award">Award</span>
        <div class="news-what"><b>Best Poster Award</b>, Midwest Robotics Workshop, for <em>&ldquo;Contraction-Aware Reinforcement Learning for Nonlinear Control and Statistical Robustness.&rdquo;</em></div>
      </div>

      <div class="news-row">
        <span class="news-when">2026</span>
        <span class="news-kind" data-kind="award">Award</span>
        <div class="news-what"><b>Silver Reviewer Award</b> (top tier), International Conference on Machine Learning (ICML).</div>
      </div>

      <div class="news-row">
        <span class="news-when">2025</span>
        <span class="news-kind" data-kind="paper">Paper</span>
        <div class="news-what"><em>&ldquo;Out of Distribution Adaptation&hellip;&rdquo;</em> published in <b>Mathematics: Statistics and Operational Research</b>.</div>
      </div>

      <div class="news-row">
        <span class="news-when">2025</span>
        <span class="news-kind" data-kind="fellowship">Fellowship</span>
        <div class="news-what"><b>University Block Grant Fellowship</b> (outstanding academic &amp; research achievement): $880, Dept. of Aerospace Engineering, UIUC.</div>
      </div>

      <div class="news-row">
        <span class="news-when">2025</span>
        <span class="news-kind" data-kind="award">Award</span>
        <div class="news-what"><b>AE Graduate Research Poster Competition</b> (Best Oral Delivery): $200, Dept. of Aerospace Engineering, UIUC.</div>
      </div>

      <div class="news-row">
        <span class="news-when">2024</span>
        <span class="news-kind" data-kind="fellowship">Fellowship</span>
        <div class="news-what"><b>Stillwell Fellowship</b>: $12,555, Dept. of Aerospace Engineering, UIUC.</div>
      </div>

      <div class="news-row">
        <span class="news-when">2024</span>
        <span class="news-kind" data-kind="fellowship">Fellowship</span>
        <div class="news-what"><b>Beatty Fellowship</b>: $6,000, Dept. of Aerospace Engineering, UIUC.</div>
      </div>

      <div class="news-row">
        <span class="news-when">2024</span>
        <span class="news-kind" data-kind="paper">Paper</span>
        <div class="news-what"><em>&ldquo;Constrained meta-reinforcement learning&hellip;&rdquo;</em> published in <b>Proceedings of AAAI</b>.</div>
      </div>

    </div>

    <button class="btn-x btn-x--ghost btn-x--sm news-more" type="button" id="news-more" aria-expanded="false" aria-controls="news-list">Show all updates</button>

  </div>
</section>

<!-- ============================= 06 · CONTACT ============================ -->
<section class="contact">
  <div class="wrap contact__inner">
    <div>
      <p class="eyebrow">Get in touch</p>
      <h2>Let&rsquo;s talk.</h2>
      <p>Happy to hear from anyone working on RL-based control &mdash; or with a question about one of the papers above.</p>
    </div>
    <div class="contact__links">
      <a class="btn-x btn-x--onDark" href="mailto:minjae5@illinois.edu">Email</a>
      <a class="btn-x btn-x--onDarkGhost" href="https://scholar.google.com/citations?user=w2klAW4AAAAJ" target="_blank" rel="noopener">Google Scholar</a>
      <a class="btn-x btn-x--onDarkGhost" href="https://github.com/mgineer117" target="_blank" rel="noopener">GitHub</a>
      <a class="btn-x btn-x--onDarkGhost" href="https://linkedin.com/in/mj-minjae-cho-407b9a224" target="_blank" rel="noopener">LinkedIn</a>
      <a class="btn-x btn-x--onDarkGhost" href="{{ base_path }}/cv/">CV</a>
    </div>
  </div>
</section>
