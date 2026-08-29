---
layout: section
title: "Curriculum Vitae"
permalink: /cv/
hero:
  field: contract
  eyebrow: "Full record"
  lede: "Education, publications, awards, funding, teaching, and service."
redirect_from:
  - /resume
---

{% include base_path %}

<section class="sec">
  <div class="wrap">

    <div class="cv-bar reveal">
      <p class="cv-bar__note">Last updated from <code>files/CV.pdf</code></p>
      <div class="cv-bar__links">
        <a class="btn-x btn-x--sm" href="{{ base_path }}/files/CV.pdf" download>Download PDF</a>
        <a class="btn-x btn-x--sm btn-x--ghost" href="{{ base_path }}/files/CV.pdf" target="_blank" rel="noopener">Open in a new tab</a>
      </div>
    </div>

    <div class="cv-frame reveal">
      <iframe src="{{ base_path }}/files/CV.pdf" title="Curriculum Vitae of MJ (Minjae) Cho" loading="lazy">
      </iframe>
      <p class="cv-frame__fallback">
        Your browser will not display the PDF inline &mdash;
        <a href="{{ base_path }}/files/CV.pdf">download it instead</a>.
      </p>
    </div>

  </div>
</section>
