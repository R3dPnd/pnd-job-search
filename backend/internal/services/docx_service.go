package services

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"fmt"
	"io"
	"strings"
)

type DocxService struct{}

func NewDocxService() *DocxService {
	return &DocxService{}
}

// ExtractText reads a .docx file and returns its plain text content.
// DOCX is a ZIP containing word/document.xml with <w:t> text elements.
func (d *DocxService) ExtractText(filePath string) (string, error) {
	r, err := zip.OpenReader(filePath)
	if err != nil {
		return "", fmt.Errorf("open docx: %w", err)
	}
	defer r.Close()

	for _, f := range r.File {
		if f.Name != "word/document.xml" {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			return "", fmt.Errorf("open document.xml: %w", err)
		}
		defer rc.Close()
		return extractXMLText(rc)
	}
	return "", fmt.Errorf("word/document.xml not found in docx")
}

// GenerateDocx creates a minimal valid .docx from plain text, one paragraph per newline.
func (d *DocxService) GenerateDocx(text string) ([]byte, error) {
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)

	addFile := func(name, content string) {
		f, _ := zw.Create(name)
		f.Write([]byte(content)) //nolint:errcheck
	}

	addFile("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`)

	addFile("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`)

	addFile("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`)

	docFile, _ := zw.Create("word/document.xml")
	writeDocumentXML(docFile, text)

	if err := zw.Close(); err != nil {
		return nil, fmt.Errorf("finalize docx: %w", err)
	}
	return buf.Bytes(), nil
}

func writeDocumentXML(w io.Writer, text string) {
	io.WriteString(w, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`+"\n") //nolint:errcheck
	io.WriteString(w, `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>`) //nolint:errcheck
	for _, line := range strings.Split(text, "\n") {
		io.WriteString(w, "<w:p>") //nolint:errcheck
		if strings.TrimSpace(line) != "" {
			io.WriteString(w, `<w:r><w:t xml:space="preserve">`) //nolint:errcheck
			xml.EscapeText(w, []byte(line))                      //nolint:errcheck
			io.WriteString(w, "</w:t></w:r>")                    //nolint:errcheck
		}
		io.WriteString(w, "</w:p>") //nolint:errcheck
	}
	io.WriteString(w, "<w:sectPr/></w:body></w:document>") //nolint:errcheck
}

func extractXMLText(r io.Reader) (string, error) {
	var sb strings.Builder
	decoder := xml.NewDecoder(r)

	inText := false
	for {
		tok, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", fmt.Errorf("xml decode: %w", err)
		}

		switch t := tok.(type) {
		case xml.StartElement:
			// <w:t> — text run
			if t.Name.Local == "t" {
				inText = true
			}
			// <w:p> — paragraph break
			if t.Name.Local == "p" {
				sb.WriteString("\n")
			}
		case xml.EndElement:
			if t.Name.Local == "t" {
				inText = false
			}
		case xml.CharData:
			if inText {
				sb.Write(t)
			}
		}
	}

	return strings.TrimSpace(sb.String()), nil
}
