import React, { useRef, useEffect, useState } from "react";
import { toast } from "sonner";
import dynamic from "next/dynamic";

// Dynamically import Monaco Editor to avoid SSR issues
const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-96 border border-gray-700 rounded-lg flex items-center justify-center bg-gray-900">
        <div className="text-white">Loading editor...</div>
      </div>
    ),
  }
);

const SolidityCodeEditor: React.FC = () => {
  const [solidityCode, setSolidityCode] = useState<string>("");
  const [deploy, setDeploy] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    // Define the Solidity language
    monaco.languages.register({ id: "solidity" });

    // Define the syntax highlighting rules for Solidity
    monaco.languages.setMonarchTokensProvider("solidity", {
      keywords: [
        "contract", "function", "uint", "mapping", "address", "returns",
        "public", "private", "external", "internal", "view", "payable",
        "pure", "constant", "if", "else", "while", "for", "return",
        "new", "delete", "pragma", "solidity", "import", "modifier",
        "event", "struct", "enum", "library", "interface"
      ],
      operators: [
        "+", "-", "*", "/", "%", "!", "=", "==", "!=", ">", ">=",
        "<", "<=", "&&", "||", "&", "|", "^", "<<", ">>", "++", "--", "?", ":"
      ],
      symbols: /[=><!~?:&|+\-*\/\^%]+/,
      tokenizer: {
        root: [
          { include: "@whitespace" },
          { include: "@comment" },
          { include: "@string" },
          { include: "@number" },
          { include: "@keyword" },
          { include: "@operator" },
        ],
        whitespace: [[/\s+/, "white"]],
        comment: [
          [/\/\/.*$/, "comment"],
          [/#.*$/, "comment"],
          [/\/\*/, { token: "comment.quote", next: "@commentEnd" }],
        ],
        commentEnd: [
          [/[^\/*]+/, "comment.quote"],
          [/\*\//, { token: "comment.quote", next: "@pop" }],
          [/[\/*]/, "comment.quote"],
        ],
        string: [
          [/"/, { token: "string.quote", next: "@stringEndDoubleQuote" }],
          [/'/, { token: "string.quote", next: "@stringEndSingleQuote" }],
        ],
        stringEndDoubleQuote: [
          [/[^\\"]+/, "string"],
          [/\\./, "string.escape"],
          [/"/, { token: "string.quote", next: "@pop" }],
        ],
        stringEndSingleQuote: [
          [/[^\\']+/, "string"],
          [/\\./, "string.escape"],
          [/'/, { token: "string.quote", next: "@pop" }],
        ],
        number: [
          [/\d*\.\d+([eE][\-+]?\d+)?/, "number.float"],
          [/0[xX][0-9a-fA-F]+/, "number.hex"],
          [/\d+/, "number"],
        ],
        keyword: [
          [/@[a-zA-Z_$][\w$]*/, "annotation"],
          [
            /\b(contract|function|uint|mapping|address|returns|public|private|external|internal|view|payable|pure|constant|if|else|while|for|return|new|delete|pragma|solidity|import|modifier|event|struct|enum|library|interface)\b/,
            "keyword",
          ],
        ],
        operator: [[/[+\-*\/%=&|<>!^]+/, "operator"]],
      },
    });

    // DON'T change the language here - let Monaco handle it
    // Remove this line: monaco.editor.setModelLanguage(editor.getModel(), "solidity");
  };

  const handleCompile = async () => {
    if (!solidityCode.trim()) {
      toast.error("Please enter some Solidity code before compiling.");
      return;
    }

    // Clean the code before sending
    const cleanCode = solidityCode.trim();
    console.log("Sending code:", cleanCode.substring(0, 100));

    setLoading(true);
    
    try {
      const response = await fetch("http://localhost:5000/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: cleanCode }), // Send cleaned code
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }
      
      const data = await response.json();
      console.log("API response:", data);
      
      setDeploy(true);
      setLoading(false);
      toast.success(`Deployment successful at ${data.deployedContract}`);
      
      setTimeout(() => {
        setDeploy(false);
      }, 3000);
      
    } catch (error) {
      console.error("Compilation error:", error);
      setLoading(false);
      
      if (error instanceof Error) {
        if (error.message.includes("Failed to fetch")) {
          toast.error("Cannot connect to compilation server. Please ensure the backend service is running on port 5000.");
        } else if (error.message.includes("500")) {
          toast.error("Server error during compilation. Check your Solidity code syntax and server logs.");
        } else {
          toast.error(`Compilation failed: ${error.message}`);
        }
      } else {
        toast.error("An unexpected error occurred during compilation.");
      }
    }
  };

  if (!isClient) {
    return (
      <div className="w-full h-96 border border-gray-700 rounded-lg flex items-center justify-center bg-gray-900">
        <div className="text-white">Loading editor...</div>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-center mt-2 mb-2 text-lg font-bold">Solidity Editor</h2>
      <div className="w-full h-96 border border-gray-700 rounded-lg overflow-hidden">
        <MonacoEditor
          height="100%"
          defaultLanguage="solidity" // Set directly to solidity
          theme="vs-dark"
          value={solidityCode}
          onChange={(value) => setSolidityCode(value || "")}
          onMount={handleEditorDidMount}
          options={{
            automaticLayout: true,
            minimap: { enabled: false },
            lineNumbers: "on",
            folding: true,
            fontSize: 14,
            fontFamily: "Menlo, Monaco, 'Courier New', monospace",
            wordWrap: "on",
            scrollBeyondLastLine: false,
            renderLineHighlight: "all",
            selectOnLineNumbers: true,
            matchBrackets: "always",
            autoIndent: "full",
            formatOnPaste: true,
            formatOnType: true,
          }}
        />
      </div>
      
      <button
        className="fixed bottom-4 right-6 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white px-6 py-3 rounded-md shadow-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400"
        onClick={handleCompile}
        disabled={loading}
      >
        {loading ? (
          <span className="flex items-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Compiling...
          </span>
        ) : (
          "Compile & Deploy"
        )}
      </button>
      
      {loading && (
        <div className="fixed top-4 right-6 bg-blue-500 text-white px-4 py-2 rounded-md shadow-lg">
          <span className="flex items-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Compiling contract...
          </span>
        </div>
      )}
    </>
  );
};

export default SolidityCodeEditor;
