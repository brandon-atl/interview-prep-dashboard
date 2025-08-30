# **A Deployment-First Approach for Web-Based Applications on Vercel and GitHub**

## **Executive Summary: Embracing the Production Environment**

The new context that the dashboard will be hosted on Vercel and GitHub clarifies the strategic goal and streamlines the technical solution. The file-loading issue previously diagnosed was a direct result of running the application in a local file:/// environment, which is subject to strict browser security policies. By deploying to a hosting platform like Vercel, the application is moved into a standard web environment (https://...), which is precisely what its code was designed for.

This revised approach confirms that the dashboard's existing HTML and JavaScript code is **already correct and production-ready**.1 The relative-path

fetch calls used to load data are the industry-standard method for this exact scenario. Consequently, the solution is not to modify the code or run a local server, but simply to deploy the project to Vercel using its existing file structure.

This guide will briefly explain the critical distinction between local and deployed environments to clarify why the issue occurred during local testing. It will then provide a straightforward, step-by-step guide for deploying the project via GitHub to Vercel, resulting in a fully functional, publicly accessible dashboard with automatic file loading.

## **The Environment Shift: Why It Fails Locally but Succeeds on Vercel**

The core of this issue lies in the difference between how a browser treats a file on your computer versus a file on the internet. Understanding this distinction is key to modern web development.

### **The Local Environment (file:/// Protocol)**

When you double-click index.html on your desktop, the browser opens it using the file:// protocol. For security reasons, every local file is treated as its own unique, isolated "origin".2 As detailed in the initial report, the Same-Origin Policy (SOP) then blocks the JavaScript in

index.html from reading other files, even those in the input\_files subfolder, because they are considered to be from a different origin.4 This is a crucial security feature to prevent malicious downloaded web pages from accessing your personal files.6 The local web server proposed in the initial report was the standard solution to overcome this specific local development challenge.

### **The Deployed Environment (https:// Protocol on Vercel/GitHub)**

When you deploy your project, all of its files (index.html, and everything in input\_files/) are uploaded to Vercel's servers. When a user visits your dashboard, Vercel serves these files over the https:// protocol.

Consider your Vercel URL: https://interview-prep-dashboard.vercel.app/

* Your dashboard page is at: https://your-project.vercel.app/index.html  
* A data file is at: https://your-project.vercel.app/input\_files/data.csv

Because the **scheme** (https), **hostname** (your-project.vercel.app), and **port** (443, the default for HTTPS) are identical, the browser now considers all of your project's files to be from the **same origin**. The Same-Origin Policy is satisfied, and the browser permits the JavaScript in index.html to freely fetch and process the data files.

In essence, Vercel itself is acting as the web server, creating the exact environment your code was built for.

## **Confirmation of Code Correctness: No Changes Needed**

A review of the dashboard's loadSampleData function confirms it is correctly implemented for a deployed environment.1 The function uses relative paths in its

fetch calls, such as:

JavaScript

fetch('input\_files/google\_play\_interview\_qa.md')

This is the correct and standard practice. When executed from the deployed index.html page, this relative path correctly resolves to the full URL of the data file on the Vercel server. The existing logic for handling different file types (PDFs, DOCX, CSVs) remains perfectly valid and functional in this context.1

**Therefore, no modifications to the existing HTML or JavaScript are necessary to achieve your goal.**

## **Revised Implementation Guide: Deploying Your Dashboard to Vercel**

The path to a working dashboard is to commit your project to a GitHub repository and then connect that repository to Vercel for automatic deployment.

### **Step 1: Verify Your Project Structure**

Ensure your project folder is organized correctly before uploading. The input\_files directory must be located within the same main project folder as your index.html file.

your-project-folder/  
├── index.html  
└── input\_files/  
    ├── 08-28 Interview\_ Google Play...pdf  
    ├── Brandon Abbott Resume...pdf  
    ├── Google Q\&A Bank.md  
    └──... (all other data files)

### **Step 2: Push Your Project to GitHub**

If you have not already, create a new repository on GitHub and upload your entire project folder.

1. **Initialize Git:** Open a terminal in your project folder and run git init.  
2. **Add Files:** Stage all your files for commit by running git add..  
3. **Commit Files:** Create a commit with a message: git commit \-m "Initial dashboard commit".  
4. **Connect and Push:** Follow GitHub's instructions to connect your local repository to the remote one and push your files: git remote add origin... followed by git push \-u origin main.

### **Step 3: Deploy the Project on Vercel**

Vercel's integration with GitHub makes this process seamless.

1. **Sign Up/Log In:** Go to [vercel.com](https://vercel.com) and sign up using your GitHub account.  
2. **Import Project:** From your Vercel dashboard, click "Add New..." and select "Project".  
3. **Import Git Repository:** Vercel will show a list of your GitHub repositories. Find your dashboard repository and click "Import".  
4. **Configure Project:** Vercel will automatically detect that it is a static site. You do not need to change any of the default settings (like "Framework Preset" or "Build and Output Settings").  
5. **Deploy:** Click the "Deploy" button.

Vercel will now pull your code from GitHub, build it, and deploy it to its global network. The process typically takes less than a minute.

### **Step 4: Access Your Live Dashboard**

Once the deployment is complete, Vercel will provide you with a public URL (e.g., your-project.vercel.app). Visiting this URL will now load your dashboard, and you will see that all the files from the input\_files directory are loaded and processed automatically, exactly as intended.

## 

## **Conclusion: Aligning the Environment with the Application**

The challenge of automatically loading files was not an issue with the dashboard's code, but rather a classic case of a development environment (file:///) behaving differently from a production environment (https://). The initial analysis provided the correct solution for local testing, while this revised approach provides the direct path to production deployment.

By hosting the project on Vercel, you are placing it in the environment it was designed for, where browser security models work with, not against, the application's architecture. The user's original code was robust and well-structured, requiring no changes to function perfectly once deployed. This deployment-first approach resolves the issue completely and aligns the project with modern web development best practices.

#### **Works cited**

1. Claude \- Google Dashboard  
2. Same-origin policy \- Security \- MDN \- Mozilla, accessed August 30, 2025, [https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin\_policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy)  
3. What is the Same-Origin Policy for File URIs? \- Stack Overflow, accessed August 30, 2025, [https://stackoverflow.com/questions/48313084/what-is-the-same-origin-policy-for-file-uris](https://stackoverflow.com/questions/48313084/what-is-the-same-origin-policy-for-file-uris)  
4. Suggestion: You should be able to load module-scripts in the file:// protocol. \#8121 \- GitHub, accessed August 30, 2025, [https://github.com/whatwg/html/issues/8121](https://github.com/whatwg/html/issues/8121)  
5. How do I load a local JS file on a local web page? Mine is blocked by CORS policy. \- Reddit, accessed August 30, 2025, [https://www.reddit.com/r/learnjavascript/comments/nv1qq9/how\_do\_i\_load\_a\_local\_js\_file\_on\_a\_local\_web\_page/](https://www.reddit.com/r/learnjavascript/comments/nv1qq9/how_do_i_load_a_local_js_file_on_a_local_web_page/)  
6. Local file access with JavaScript \- Stack Overflow, accessed August 30, 2025, [https://stackoverflow.com/questions/371875/local-file-access-with-javascript](https://stackoverflow.com/questions/371875/local-file-access-with-javascript)  
7. Why do browsers disallow accessing files from local file system even if the HTML document is also on the local file system? \- Information Security Stack Exchange, accessed August 30, 2025, [https://security.stackexchange.com/questions/201208/why-do-browsers-disallow-accessing-files-from-local-file-system-even-if-the-html](https://security.stackexchange.com/questions/201208/why-do-browsers-disallow-accessing-files-from-local-file-system-even-if-the-html)