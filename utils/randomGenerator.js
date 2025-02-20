const generateRandomImage = () => {
    const width = Math.floor(Math.random() * 1000) + 400;
    const height = Math.floor(Math.random() * 1000) + 300;
    return `https://picsum.photos/seed/${Math.random()}/${width}/${height}`;
  };

  const generateRandomTitle = () => {
    const titles = [
      "Lorem ipsum dolor sit amet",
      "Consectetur adipiscing elit",
      "Sed do eiusmod tempor incididunt",
      "Ut labore et dolore magna aliqua",
      "Ut enim ad minim veniam",
      "Quis nostrud exercitation ullamco",
      "Laboris nisi ut aliquip",
      "Ex ea commodo consequat",
    ];
    return titles[Math.floor(Math.random() * titles.length)];
  };

  const generateRandomParagraph = (n = 50) => {
    n = Math.floor(n); // Ensure n is an integer
    const words = ["Lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit","Sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore", "magna", "aliqua", "Ut", "enim", "ad", "minim", "veniam", "Quis", "nostrud", "exercitation", "ullamco", "laboris", "nisi", "ut", "aliquip", "ex", "ea", "commodo", "consequat","Duis", "aute", "irure", "dolor", "in", "reprehenderit", "in", "voluptate", "velit", "esse", "cillum", "dolore", "eu", "fugiat", "nulla", "pariatur", "Excepteur", "sint", "occaecat", "cupidatat", "non", "proident", "sunt", "in", "culpa", "qui", "officia", "deserunt", "mollit", "anim", "id", "est", "laborum", "Sed", "ut", "perspiciatis", "unde", "omnis", "iste", "natus", "error", "sit", "voluptatem", "accusantium", "doloremque", "laudantium", "totam", "rem", "aperiam", "eaque", "ipsa", "quae", "ab", "illo", "inventore", "veritatis", "et", "quasi", "architecto", "beatae", "vitae", "dicta", "sunt", "explicabo","Nemo", "enim", "ipsam", "voluptatem", "quia", "voluptas", "sit", "aspernatur", "aut", "odit", "aut", "fugit", "sed", "quia", "consequuntur", "magni", "dolores", "eos", "qui", "ratione", "voluptatem", "sequi", "nesciunt", "Neque", "porro", "quisquam", "est", "qui", "dolorem", "ipsum", "quia", "dolor", "sit", "amet", "consectetur", "adipisci", "velit", "sed", "quia", "non", "numquam", "eius", "modi", "tempora", "incidunt", "ut", "labore", "et", "dolore", "magnam", "aliquam", "quaerat", "voluptatem", "Ut", "enim", "ad", "minima", "veniam", "quis", "nostrum", "exercitationem", "ullam", "corporis", "suscipit", "laboriosam", "nisi", "ut", "aliquid", "ex", "ea", "commodi", "consequatur", "Quis", "autem", "vel", "eum", "iure", "reprehenderit", "qui", "in", "ea", "voluptate", "velit", "esse", "quam", "nihil", "molestiae", "et", "iusto", "odio", "dignissimos", "ducimus", "qui", "blanditiis", "praesentium", "voluptatum", "deleniti", "atque", "corrupti", "quos", "dolores", "et", "quas", "molestias", "excepturi", "sint", "occaecati", "cupiditate", "non", "provident", "sed", "ut", "perspiciatis", "unde", "omnis", "iste", "natus", "error", "sit", "voluptatem", "accusantium", "doloremque", "laudantium", "totam", "rem", "aperiam", "eaque", "ipsa", "quae", "ab", "illo", "inventore", "veritatis", "et", "quasi", "architecto", "beatae", "vitae", "dicta", "sunt", "explicabo", "architecto", "beatae", "vitae", "dicta", "sunt", "explicabo", "basdf"];

    const randomWords = Array.from({ length: n }, () => words[Math.floor(Math.random() * words.length)]);
    randomWords[0] = randomWords[0].charAt(0).toUpperCase() + randomWords[0].slice(1);
    randomWords[randomWords.length - 1] += ".";
    for (let i = 4; i < randomWords.length; i += Math.floor(Math.random() * 7) + 4) {
      randomWords[i] += ",";
    }
    for (let i = 7; i < randomWords.length; i += Math.floor(Math.random() * 8) + 7) {
      randomWords[i] += ".";
      if (i + 1 < randomWords.length) {
        randomWords[i + 1] = randomWords[i + 1].charAt(0).toUpperCase() + randomWords[i + 1].slice(1);
      }
    }
    return randomWords.join(" ");
  };

  const generateRandomArticle = () => {
    return `
      <article>
        <img src="${generateRandomImage()}" alt="${generateRandomTitle()}" />
        <h2>${generateRandomTitle()}</h2>
        <p>${generateRandomParagraph(Math.random() * 50)}</p>
      </article>
    `;
  };

const generateRandomHero = () => {
    return `
        <section class="hero">
            <div class="hero-content">
                <h1>${generateRandomTitle()}</h1>
                <p>${generateRandomParagraph(30)}</p>
            </div>
            <div class="hero-image">
                <img src="${generateRandomImage()}" alt="${generateRandomTitle()}" />
            </div>
        </section>
    `;
};

  const generateRandomArticles = (n = 3 ) => Array.from({ length: n }, generateRandomArticle).join("");

  export { generateRandomImage, generateRandomTitle, generateRandomParagraph, generateRandomArticle, generateRandomArticles, generateRandomHero };
  export default generateRandomArticles;