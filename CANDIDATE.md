Generate a score between 0 and 100 for a given Candidate and Resume, using the following rules:

- Resume is articulate, clear, easy to read, well formatted, and not full of buzzwords. Judge the writing style with an eye for the authors ability to communicate clearly. Bonus points for a good cover letter.
- Career history is varied and not all enterprise
- A good match for our tech stack: Typescript/JavaScript, MySQL, Kubernetes, Pulumi, Argo, Prometheus, SaltStack, Vitess, AWS, EKS, Datadog, Node.js
- Has github profile (in resume or in greenhouse), github profile has some open source projects, some recent activity, especially if the projects are related to platform engineering, typescript, or education.
- Positions are mostly IC roles, some management and leadership is good, but should be mostly development / engineering focused

You will be given a path to a directory for each candidate which contains their resume. Ideally, the resume pages will be stored as .png files like `resume-0.png` (page 0), `resume-1.png`, and so on. If no .png files exist, try to read a docx or PDF file as a backup.