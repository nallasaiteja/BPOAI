import os
from io import BytesIO
from django.conf import settings
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

# Register TrueType font for PDF Unicode Rupee symbol support
FONT_NORMAL = 'Helvetica'
FONT_BOLD = 'Helvetica-Bold'
PDF_RUPEE_PREFIX = 'INR '

try:
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    arial_path = 'C:/Windows/Fonts/arial.ttf'
    arial_bold_path = 'C:/Windows/Fonts/arialbd.ttf'
    if os.path.exists(arial_path) and os.path.exists(arial_bold_path):
        pdfmetrics.registerFont(TTFont('Arial', arial_path))
        pdfmetrics.registerFont(TTFont('Arial-Bold', arial_bold_path))
        FONT_NORMAL = 'Arial'
        FONT_BOLD = 'Arial-Bold'
        PDF_RUPEE_PREFIX = '₹'
except Exception:
    FONT_NORMAL = 'Helvetica'
    FONT_BOLD = 'Helvetica-Bold'
    PDF_RUPEE_PREFIX = 'INR '


def format_inr(amount, symbol='₹') -> str:
    """
    Formats a numeric amount into Indian numbering format (e.g. ₹1,25,000.00).
    """
    if amount is None:
        return f"{symbol}0.00"
    try:
        val = float(amount)
    except (ValueError, TypeError):
        return f"{symbol}0.00"

    s = f"{abs(val):.2f}"
    parts = s.split('.')
    integer_part, decimal_part = parts[0], parts[1]
    
    if len(integer_part) > 3:
        last3 = integer_part[-3:]
        remaining = integer_part[:-3]
        groups = []
        while len(remaining) > 2:
            groups.insert(0, remaining[-2:])
            remaining = remaining[:-2]
        if remaining:
            groups.insert(0, remaining)
        integer_part = ','.join(groups) + ',' + last3

    prefix = f"-{symbol}" if val < 0 else symbol
    return f"{prefix}{integer_part}.{decimal_part}"


class ProposalDocumentEngine:
    """
    Renders professional, branded PDF and DOCX documents for Proposals & Commercial Quotations.
    Uses Indian Rupees (INR) with standard Indian numbering format.
    """

    @classmethod
    def generate_pdf(cls, proposal, config) -> BytesIO:
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=54, leftMargin=54,
            topMargin=54, bottomMargin=54
        )

        styles = getSampleStyleSheet()
        primary_color = colors.HexColor('#0F172A')  # Slate 900
        accent_color = colors.HexColor('#2563EB')   # Blue 600

        title_style = ParagraphStyle(
            'DocTitle',
            parent=styles['Heading1'],
            fontName=FONT_BOLD,
            fontSize=22,
            leading=26,
            textColor=primary_color,
            spaceAfter=8
        )

        subtitle_style = ParagraphStyle(
            'DocSubtitle',
            parent=styles['Normal'],
            fontName=FONT_BOLD,
            fontSize=11,
            leading=14,
            textColor=accent_color,
            spaceAfter=14
        )

        section_heading = ParagraphStyle(
            'SectionHeading',
            parent=styles['Heading2'],
            fontName=FONT_BOLD,
            fontSize=14,
            leading=18,
            textColor=primary_color,
            spaceBefore=14,
            spaceAfter=6
        )

        body_style = ParagraphStyle(
            'Body',
            parent=styles['Normal'],
            fontName=FONT_NORMAL,
            fontSize=10,
            leading=14,
            textColor=colors.HexColor('#334155'),
            spaceAfter=8
        )

        elements = []

        # Header Branding
        elements.append(Paragraph(config.brand_display_name.upper(), subtitle_style))
        elements.append(Paragraph(proposal.title, title_style))
        elements.append(Paragraph(f"Prepared for: <b>{proposal.lead.company_name}</b> | Ref: {proposal.proposal_code}", body_style))
        elements.append(HRFlowable(width="100%", thickness=1.5, color=accent_color, spaceBefore=4, spaceAfter=14))

        # Executive Summary
        elements.append(Paragraph("1. Executive Summary", section_heading))
        elements.append(Paragraph((proposal.executive_summary or '').replace('\n', '<br/>'), body_style))
        elements.append(Spacer(1, 10))

        # Problem Statement & Evidence
        elements.append(Paragraph("2. Identified Challenges & Strategic Objectives", section_heading))
        elements.append(Paragraph((proposal.identified_challenges or '').replace('\n', '<br/>'), body_style))
        elements.append(Spacer(1, 10))

        # Solution & Deliverables
        elements.append(Paragraph("3. Proposed Scope of Work & Deliverables", section_heading))
        elements.append(Paragraph((proposal.proposed_solution or '').replace('\n', '<br/>'), body_style))

        if proposal.deliverables:
            deliv_items = [[Paragraph(f"• {item}", body_style)] for item in proposal.deliverables]
            t_deliv = Table(deliv_items, colWidths=[500])
            t_deliv.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ]))
            elements.append(t_deliv)
            elements.append(Spacer(1, 10))

        # Commercial Quotation Table (if attached)
        if hasattr(proposal, 'quotation'):
            quot = proposal.quotation
            has_pricing = quot.line_items.exists() and quot.total_amount > 0
            curr_label = "INR"

            elements.append(Paragraph(f"4. Commercial Investment ({curr_label})", section_heading))
            
            if not has_pricing:
                elements.append(Paragraph("<b>Pricing Status:</b> <i>Pending Pricing / Price Not Set</i>", body_style))
                elements.append(Paragraph("Line items and commercial rates are being configured by the Merugu Global accounts team.", body_style))
                elements.append(Spacer(1, 12))
            else:
                table_data = [
                    ['Service Description', 'Qty', f'Unit Price ({curr_label})', f'Total ({curr_label})']
                ]
                for item in quot.line_items.all():
                    table_data.append([
                        item.description,
                        str(item.quantity),
                        format_inr(item.unit_price, PDF_RUPEE_PREFIX),
                        format_inr(item.total_price, PDF_RUPEE_PREFIX)
                    ])
                table_data.append(['Subtotal', '', '', format_inr(quot.subtotal, PDF_RUPEE_PREFIX)])
                
                if quot.discount_amount and quot.discount_amount > 0:
                    disc_label = f"Discount ({quot.discount_percentage}%)" if quot.discount_percentage > 0 else "Discount"
                    table_data.append([disc_label, '', '', f"-{format_inr(quot.discount_amount, PDF_RUPEE_PREFIX)}"])
                
                table_data.append([f'Applicable GST / Taxes ({quot.tax_rate}%)', '', '', format_inr(quot.tax_amount, PDF_RUPEE_PREFIX)])
                table_data.append(['Grand Total', '', '', format_inr(quot.total_amount, PDF_RUPEE_PREFIX)])

                q_table = Table(table_data, colWidths=[260, 50, 95, 95])
                q_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F1F5F9')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), primary_color),
                    ('FONTNAME', (0, 0), (-1, 0), FONT_BOLD),
                    ('FONTSIZE', (0, 0), (-1, -1), 9),
                    ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
                    ('LINEBELOW', (0, 0), (-1, 0), 1.5, primary_color),
                    ('LINEBELOW', (0, -3), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
                    ('FONTNAME', (0, -1), (-1, -1), FONT_BOLD),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                    ('TOPPADDING', (0, 0), (-1, -1), 5),
                ]))
                elements.append(q_table)
                elements.append(Spacer(1, 12))

        # Payment Terms & Sign-off
        elements.append(Paragraph("5. Terms & Authorization", section_heading))
        elements.append(Paragraph(f"<b>Payment Terms:</b> {config.payment_terms}", body_style))
        elements.append(Paragraph(f"<b>Terms & Warranty:</b> {config.terms_and_conditions}", body_style))
        elements.append(Spacer(1, 14))

        elements.append(Paragraph(f"<b>Authorized Signatory:</b> {config.authorized_signatory_name} ({config.authorized_signatory_title})", body_style))
        elements.append(Paragraph(f"<b>Corporate Entity:</b> {config.company_legal_name}", body_style))

        doc.build(elements)
        buffer.seek(0)
        return buffer

    @classmethod
    def generate_docx(cls, proposal, config) -> BytesIO:
        buffer = BytesIO()
        doc = Document()

        # Title
        p_title = doc.add_paragraph()
        r_sub = p_title.add_run(f"{config.brand_display_name.upper()}\n")
        r_sub.font.size = Pt(11)
        r_sub.font.bold = True
        r_sub.font.color.rgb = RGBColor(37, 99, 235)

        r_title = p_title.add_run(proposal.title)
        r_title.font.size = Pt(20)
        r_title.font.bold = True
        r_title.font.color.rgb = RGBColor(15, 23, 42)

        doc.add_paragraph(f"Client: {proposal.lead.company_name} | Ref: {proposal.proposal_code}")
        doc.add_heading("1. Executive Summary", level=1)
        doc.add_paragraph(proposal.executive_summary or '')

        doc.add_heading("2. Challenges & Strategic Objectives", level=1)
        doc.add_paragraph(proposal.identified_challenges or '')

        doc.add_heading("3. Proposed Scope of Work & Deliverables", level=1)
        doc.add_paragraph(proposal.proposed_solution or '')

        for d in (proposal.deliverables or []):
            doc.add_paragraph(d, style='List Bullet')

        if hasattr(proposal, 'quotation'):
            quot = proposal.quotation
            has_pricing = quot.line_items.exists() and quot.total_amount > 0
            doc.add_heading("4. Commercial Quotation (INR - ₹)", level=1)
            
            if not has_pricing:
                doc.add_paragraph("Pricing Status: Pending Pricing / Price Not Set (awaiting line-item pricing configuration).")
            else:
                table = doc.add_table(rows=1, cols=4)
                hdr_cells = table.rows[0].cells
                hdr_cells[0].text = 'Service Description'
                hdr_cells[1].text = 'Qty'
                hdr_cells[2].text = 'Unit Price (₹)'
                hdr_cells[3].text = 'Total (₹)'

                for item in quot.line_items.all():
                    row_cells = table.add_row().cells
                    row_cells[0].text = item.description
                    row_cells[1].text = str(item.quantity)
                    row_cells[2].text = format_inr(item.unit_price, '₹')
                    row_cells[3].text = format_inr(item.total_price, '₹')

                r_sub = table.add_row().cells
                r_sub[0].text = 'Subtotal'
                r_sub[3].text = format_inr(quot.subtotal, '₹')

                if quot.discount_amount and quot.discount_amount > 0:
                    r_disc = table.add_row().cells
                    r_disc[0].text = f'Discount ({quot.discount_percentage}%)' if quot.discount_percentage > 0 else 'Discount'
                    r_disc[3].text = f"-{format_inr(quot.discount_amount, '₹')}"

                r_tax = table.add_row().cells
                r_tax[0].text = f'GST / Taxes ({quot.tax_rate}%)'
                r_tax[3].text = format_inr(quot.tax_amount, '₹')

                r_tot = table.add_row().cells
                r_tot[0].text = 'Grand Total'
                r_tot[3].text = format_inr(quot.total_amount, '₹')

        doc.add_heading("5. Terms & Conditions", level=1)
        doc.add_paragraph(f"Payment Terms: {config.payment_terms}")
        doc.add_paragraph(f"Standard Terms: {config.terms_and_conditions}")
        doc.add_paragraph(f"Signatory: {config.authorized_signatory_name}, {config.authorized_signatory_title}")

        doc.save(buffer)
        buffer.seek(0)
        return buffer
