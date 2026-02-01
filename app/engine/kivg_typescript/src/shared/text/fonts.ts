export interface FontFiles {
    [variant: string]: string;
}

export interface Font {
    family: string;
    variants: string[];
    files: FontFiles;
}

export const FONTS: Font[] = [
    {
        family: 'Roboto',
        variants: ['regular', 'bold', 'italic'],
        files: {
            regular: 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.ttf',
            bold: 'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc4.ttf',
            italic: 'https://fonts.gstatic.com/s/roboto/v30/KFOkCnqEu92Fr1Mu51xIIzI.ttf'
        }
    },
    {
        family: 'Caveat',
        variants: ['regular', 'bold'],
        files: {
            regular: 'https://fonts.gstatic.com/s/caveat/v17/WnznHAc5bAfYB2QRah7pcpNvOx-pjfJ9SIKjYBxPigs.ttf',
            bold: 'https://fonts.gstatic.com/s/caveat/v17/WnznHAc5bAfYB2QRah7pcpNvOx-pjcB6SIKjYBxPigs.ttf',
            italic: 'https://fonts.gstatic.com/s/caveat/v17/WnznHAc5bAfYB2QRah7pcpNvOx-pjfJ9SIKjYBxPigs.ttf'
        }
    },
    {
        family: 'Permanent Marker',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/permanentmarker/v16/Fh4uPib9Iyv2ucM6pGQMWimMp004HaqIfrT5nlk.ttf',
            bold: 'https://fonts.gstatic.com/s/permanentmarker/v16/Fh4uPib9Iyv2ucM6pGQMWimMp004HaqIfrT5nlk.ttf',
            italic: 'https://fonts.gstatic.com/s/permanentmarker/v16/Fh4uPib9Iyv2ucM6pGQMWimMp004HaqIfrT5nlk.ttf'
        }
    },
    {
        family: 'Architects Daughter',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/architectsdaughter/v18/KtkxAKiDZI_td1Lkx62xHZHDtgO_Y-bvTYlg5g.ttf',
            bold: 'https://fonts.gstatic.com/s/architectsdaughter/v18/KtkxAKiDZI_td1Lkx62xHZHDtgO_Y-bvTYlg5g.ttf',
            italic: 'https://fonts.gstatic.com/s/architectsdaughter/v18/KtkxAKiDZI_td1Lkx62xHZHDtgO_Y-bvTYlg5g.ttf'
        }
    },
    {
        family: 'Indie Flower',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/indieflower/v21/m8JVjfNVeKWVnh3QMuKkFcZlbkGG1dKEDw.ttf',
            bold: 'https://fonts.gstatic.com/s/indieflower/v21/m8JVjfNVeKWVnh3QMuKkFcZlbkGG1dKEDw.ttf',
            italic: 'https://fonts.gstatic.com/s/indieflower/v21/m8JVjfNVeKWVnh3QMuKkFcZlbkGG1dKEDw.ttf'
        }
    },
    {
        family: 'Shadows Into Light',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/shadowsintolight/v19/UqyNK9UOIntux_czAvDQx_ZcHqZXBNQDcsr4xzSMYA.ttf',
            bold: 'https://fonts.gstatic.com/s/shadowsintolight/v19/UqyNK9UOIntux_czAvDQx_ZcHqZXBNQDcsr4xzSMYA.ttf',
            italic: 'https://fonts.gstatic.com/s/shadowsintolight/v19/UqyNK9UOIntux_czAvDQx_ZcHqZXBNQDcsr4xzSMYA.ttf'
        }
    },
    {
        family: 'Kalam',
        variants: ['regular', 'bold'],
        files: {
            regular: 'https://fonts.gstatic.com/s/kalam/v16/YA9dr0Wd4kDdMuhWMibDszkB.ttf',
            bold: 'https://fonts.gstatic.com/s/kalam/v16/YA9Qr0Wd4kDdMtD6GgLLmCUItqGt.ttf',
            italic: 'https://fonts.gstatic.com/s/kalam/v16/YA9dr0Wd4kDdMuhWMibDszkB.ttf'
        }
    },
    {
        family: 'Patrick Hand',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/patrickhand/v20/LDI1apSQOAYtSuYWp8ZhfYeMWcjKm7sp8g.ttf',
            bold: 'https://fonts.gstatic.com/s/patrickhand/v20/LDI1apSQOAYtSuYWp8ZhfYeMWcjKm7sp8g.ttf',
            italic: 'https://fonts.gstatic.com/s/patrickhand/v20/LDI1apSQOAYtSuYWp8ZhfYeMWcjKm7sp8g.ttf'
        }
    },
    {
        family: 'Amatic SC',
        variants: ['regular', 'bold'],
        files: {
            regular: 'https://fonts.gstatic.com/s/amaticsc/v24/TUZyzwprpvBS1izr_vO0De6ecZQf1A.ttf',
            bold: 'https://fonts.gstatic.com/s/amaticsc/v24/TUZ3zwprpvBS1izr_vOMscG6eb8D3WTy-A.ttf',
            italic: 'https://fonts.gstatic.com/s/amaticsc/v24/TUZyzwprpvBS1izr_vO0De6ecZQf1A.ttf'
        }
    },
    {
        family: 'Handlee',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/handlee/v18/-F6xfjBsISg9aMakDmr6oilJ3ik.ttf',
            bold: 'https://fonts.gstatic.com/s/handlee/v18/-F6xfjBsISg9aMakDmr6oilJ3ik.ttf',
            italic: 'https://fonts.gstatic.com/s/handlee/v18/-F6xfjBsISg9aMakDmr6oilJ3ik.ttf'
        }
    },
    {
        family: 'Reenie Beanie',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/reeniebeanie/v16/z7NSdR76eDkaJKZJFkkjuvWxbP2_qoOgf_w.ttf',
            bold: 'https://fonts.gstatic.com/s/reeniebeanie/v16/z7NSdR76eDkaJKZJFkkjuvWxbP2_qoOgf_w.ttf',
            italic: 'https://fonts.gstatic.com/s/reeniebeanie/v16/z7NSdR76eDkaJKZJFkkjuvWxbP2_qoOgf_w.ttf'
        }
    },
    {
        family: 'Covered By Your Grace',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/coveredbyyourgrace/v15/QGYwz-AZahWOJJI9kykWW9mD6opopoqXSOS0FgItq6bFIg.ttf',
            bold: 'https://fonts.gstatic.com/s/coveredbyyourgrace/v15/QGYwz-AZahWOJJI9kykWW9mD6opopoqXSOS0FgItq6bFIg.ttf',
            italic: 'https://fonts.gstatic.com/s/coveredbyyourgrace/v15/QGYwz-AZahWOJJI9kykWW9mD6opopoqXSOS0FgItq6bFIg.ttf'
        }
    },
    {
        family: 'Just Another Hand',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/justanotherhand/v19/845CNN4-AJyIGvIou-6yJKyptyOpOcr_BmmlS5aw.ttf',
            bold: 'https://fonts.gstatic.com/s/justanotherhand/v19/845CNN4-AJyIGvIou-6yJKyptyOpOcr_BmmlS5aw.ttf',
            italic: 'https://fonts.gstatic.com/s/justanotherhand/v19/845CNN4-AJyIGvIou-6yJKyptyOpOcr_BmmlS5aw.ttf'
        }
    },
    {
        family: 'Dancing Script',
        variants: ['regular', 'bold'],
        files: {
            regular: 'https://fonts.gstatic.com/s/dancingscript/v24/If2cXTr6YS-zF4S-kcSWSVi_sxjsohD9F50Ruu7BMSoHTeB9ptDqpw.ttf',
            bold: 'https://fonts.gstatic.com/s/dancingscript/v24/If2cXTr6YS-zF4S-kcSWSVi_sxjsohD9F50Ruu7B1y8HTeB9ptDqpw.ttf',
            italic: 'https://fonts.gstatic.com/s/dancingscript/v24/If2cXTr6YS-zF4S-kcSWSVi_sxjsohD9F50Ruu7BMSoHTeB9ptDqpw.ttf'
        }
    },
    {
        family: 'Satisfy',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/satisfy/v17/rP2Hp2yn6lkG50LoOZSCHBeHFl0.ttf',
            bold: 'https://fonts.gstatic.com/s/satisfy/v17/rP2Hp2yn6lkG50LoOZSCHBeHFl0.ttf',
            italic: 'https://fonts.gstatic.com/s/satisfy/v17/rP2Hp2yn6lkG50LoOZSCHBeHFl0.ttf'
        }
    },
    {
        family: 'Gloria Hallelujah',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/gloriahallelujah/v17/LYjYdHv3kUk9BMV96EIswT9DIbW-MLSy3TKEvkCF.ttf',
            bold: 'https://fonts.gstatic.com/s/gloriahallelujah/v17/LYjYdHv3kUk9BMV96EIswT9DIbW-MLSy3TKEvkCF.ttf',
            italic: 'https://fonts.gstatic.com/s/gloriahallelujah/v17/LYjYdHv3kUk9BMV96EIswT9DIbW-MLSy3TKEvkCF.ttf'
        }
    },
    {
        family: 'Schoolbell',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/schoolbell/v18/92zQtBZWOrcgoe-fgnJIVxIQ6mRqfiQ.ttf',
            bold: 'https://fonts.gstatic.com/s/schoolbell/v18/92zQtBZWOrcgoe-fgnJIVxIQ6mRqfiQ.ttf',
            italic: 'https://fonts.gstatic.com/s/schoolbell/v18/92zQtBZWOrcgoe-fgnJIVxIQ6mRqfiQ.ttf'
        }
    },
    {
        family: 'Neucha',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/neucha/v17/q5uGsou0JOdh94bvugNsCxVEgA.ttf',
            bold: 'https://fonts.gstatic.com/s/neucha/v17/q5uGsou0JOdh94bvugNsCxVEgA.ttf',
            italic: 'https://fonts.gstatic.com/s/neucha/v17/q5uGsou0JOdh94bvugNsCxVEgA.ttf'
        }
    },
    {
        family: 'Courgette',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/courgette/v13/wEO_EBrAnc9BLjLQAUkFUfAL3EsHiA.ttf',
            bold: 'https://fonts.gstatic.com/s/courgette/v13/wEO_EBrAnc9BLjLQAUkFUfAL3EsHiA.ttf',
            italic: 'https://fonts.gstatic.com/s/courgette/v13/wEO_EBrAnc9BLjLQAUkFUfAL3EsHiA.ttf'
        }
    },
    {
        family: 'Pacifico',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/pacifico/v22/FwZY7-Qmy14u9lezJ96A4sijpFu_.ttf',
            bold: 'https://fonts.gstatic.com/s/pacifico/v22/FwZY7-Qmy14u9lezJ96A4sijpFu_.ttf',
            italic: 'https://fonts.gstatic.com/s/pacifico/v22/FwZY7-Qmy14u9lezJ96A4sijpFu_.ttf'
        }
    },
    {
        family: 'Rock Salt',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/rocksalt/v18/MwQ0bhv11fWD6QsAVOZbsEk7hbBWrA.ttf',
            bold: 'https://fonts.gstatic.com/s/rocksalt/v18/MwQ0bhv11fWD6QsAVOZbsEk7hbBWrA.ttf',
            italic: 'https://fonts.gstatic.com/s/rocksalt/v18/MwQ0bhv11fWD6QsAVOZbsEk7hbBWrA.ttf'
        }
    },
    {
        family: 'Sriracha',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/sriracha/v10/0nkrC9D4IuYBgWcI9ObYRQDioeb0.ttf',
            bold: 'https://fonts.gstatic.com/s/sriracha/v10/0nkrC9D4IuYBgWcI9ObYRQDioeb0.ttf',
            italic: 'https://fonts.gstatic.com/s/sriracha/v10/0nkrC9D4IuYBgWcI9ObYRQDioeb0.ttf'
        }
    },
    {
        family: 'Crafty Girls',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/craftygirls/v14/va9B4kXI39VaDdlPJo8N_NvuQR37fF3Wlg.ttf',
            bold: 'https://fonts.gstatic.com/s/craftygirls/v14/va9B4kXI39VaDdlPJo8N_NvuQR37fF3Wlg.ttf',
            italic: 'https://fonts.gstatic.com/s/craftygirls/v14/va9B4kXI39VaDdlPJo8N_NvuQR37fF3Wlg.ttf'
        }
    },
    {
        family: 'Coming Soon',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/comingsoon/v19/qWcuB6mzpYL7AJ2VfdQR1u-SUjjzsykh.ttf',
            bold: 'https://fonts.gstatic.com/s/comingsoon/v19/qWcuB6mzpYL7AJ2VfdQR1u-SUjjzsykh.ttf',
            italic: 'https://fonts.gstatic.com/s/comingsoon/v19/qWcuB6mzpYL7AJ2VfdQR1u-SUjjzsykh.ttf'
        }
    },
    {
        family: 'Short Stack',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/shortstack/v15/bMrzmS2X6p0jZC6EcmPFX-SScX8D0nq6.ttf',
            bold: 'https://fonts.gstatic.com/s/shortstack/v15/bMrzmS2X6p0jZC6EcmPFX-SScX8D0nq6.ttf',
            italic: 'https://fonts.gstatic.com/s/shortstack/v15/bMrzmS2X6p0jZC6EcmPFX-SScX8D0nq6.ttf'
        }
    },
    {
        family: 'Sedgwick Ave',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/sedgwickave/v12/uK_04rKEYuguzAcSYRdWTJq8Xmg1Vcf5JA.ttf',
            bold: 'https://fonts.gstatic.com/s/sedgwickave/v12/uK_04rKEYuguzAcSYRdWTJq8Xmg1Vcf5JA.ttf',
            italic: 'https://fonts.gstatic.com/s/sedgwickave/v12/uK_04rKEYuguzAcSYRdWTJq8Xmg1Vcf5JA.ttf'
        }
    },
    {
        family: 'Walter Turncoat',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/walterturncoat/v18/snfys0Gs98ln43n0d-14ULoToe67YB2dQ5ZPqQ.ttf',
            bold: 'https://fonts.gstatic.com/s/walterturncoat/v18/snfys0Gs98ln43n0d-14ULoToe67YB2dQ5ZPqQ.ttf',
            italic: 'https://fonts.gstatic.com/s/walterturncoat/v18/snfys0Gs98ln43n0d-14ULoToe67YB2dQ5ZPqQ.ttf'
        }
    },
    {
        family: 'Nothing You Could Do',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/nothingyoucoulddo/v15/oY1B8fbBpaP5OX3DtrRYf_Q2BPB1SnfZb0OJl1ol2Ymo.ttf',
            bold: 'https://fonts.gstatic.com/s/nothingyoucoulddo/v15/oY1B8fbBpaP5OX3DtrRYf_Q2BPB1SnfZb0OJl1ol2Ymo.ttf',
            italic: 'https://fonts.gstatic.com/s/nothingyoucoulddo/v15/oY1B8fbBpaP5OX3DtrRYf_Q2BPB1SnfZb0OJl1ol2Ymo.ttf'
        }
    },
    {
        family: 'Annie Use Your Telescope',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/annieuseyourtelescope/v18/daaLSS4tI2qYYl3Jq9s_Hu74xwktnlKxH6osGVGjlDfB3UUVZA.ttf',
            bold: 'https://fonts.gstatic.com/s/annieuseyourtelescope/v18/daaLSS4tI2qYYl3Jq9s_Hu74xwktnlKxH6osGVGjlDfB3UUVZA.ttf',
            italic: 'https://fonts.gstatic.com/s/annieuseyourtelescope/v18/daaLSS4tI2qYYl3Jq9s_Hu74xwktnlKxH6osGVGjlDfB3UUVZA.ttf'
        }
    },
    {
        family: 'Sue Ellen Francisco',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/sueellenfrancisco/v16/wXK3E20CsoJ9j1DDkjHcQ5ZL8xRaxru9ropF2lqk9H4.ttf',
            bold: 'https://fonts.gstatic.com/s/sueellenfrancisco/v16/wXK3E20CsoJ9j1DDkjHcQ5ZL8xRaxru9ropF2lqk9H4.ttf',
            italic: 'https://fonts.gstatic.com/s/sueellenfrancisco/v16/wXK3E20CsoJ9j1DDkjHcQ5ZL8xRaxru9ropF2lqk9H4.ttf'
        }
    },
    {
        family: 'Waiting for the Sunrise',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/waitingforthesunrise/v16/WBL1rFvOYl9CEv2i1mO6KUW8RKWJ2zoXoz5JsYZQ9h_ZYk5J.ttf',
            bold: 'https://fonts.gstatic.com/s/waitingforthesunrise/v16/WBL1rFvOYl9CEv2i1mO6KUW8RKWJ2zoXoz5JsYZQ9h_ZYk5J.ttf',
            italic: 'https://fonts.gstatic.com/s/waitingforthesunrise/v16/WBL1rFvOYl9CEv2i1mO6KUW8RKWJ2zoXoz5JsYZQ9h_ZYk5J.ttf'
        }
    },
    {
        family: 'Gaegu',
        variants: ['regular', 'bold'],
        files: {
            regular: 'https://fonts.gstatic.com/s/gaegu/v13/TuGSUVB6Up9NU57nifw74sdtBk0x.ttf',
            bold: 'https://fonts.gstatic.com/s/gaegu/v13/TuGfUVB6Up9NU6ZLodgzydtk.ttf',
            italic: 'https://fonts.gstatic.com/s/gaegu/v13/TuGSUVB6Up9NU57nifw74sdtBk0x.ttf'
        }
    },
    {
        family: 'Homemade Apple',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/homemadeapple/v18/Qw3EZQFXECDrI2q789EKQZJob3x9Vnksi4M7.ttf',
            bold: 'https://fonts.gstatic.com/s/homemadeapple/v18/Qw3EZQFXECDrI2q789EKQZJob3x9Vnksi4M7.ttf',
            italic: 'https://fonts.gstatic.com/s/homemadeapple/v18/Qw3EZQFXECDrI2q789EKQZJob3x9Vnksi4M7.ttf'
        }
    },
    {
        family: 'League Script',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/leaguescript/v24/CSR54zpSlumSWj9CGVsoBZdeaNNUuOwkC2s.ttf',
            bold: 'https://fonts.gstatic.com/s/leaguescript/v24/CSR54zpSlumSWj9CGVsoBZdeaNNUuOwkC2s.ttf',
            italic: 'https://fonts.gstatic.com/s/leaguescript/v24/CSR54zpSlumSWj9CGVsoBZdeaNNUuOwkC2s.ttf'
        }
    },
    {
        family: 'Bad Script',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/badscript/v16/6NUT8F6PJgbFWQn47_x7lOwuzd1AZtw.ttf',
            bold: 'https://fonts.gstatic.com/s/badscript/v16/6NUT8F6PJgbFWQn47_x7lOwuzd1AZtw.ttf',
            italic: 'https://fonts.gstatic.com/s/badscript/v16/6NUT8F6PJgbFWQn47_x7lOwuzd1AZtw.ttf'
        }
    },
    {
        family: 'Gochi Hand',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/gochihand/v19/hES06XlsOjtJsgCkx1PkTo71-n0nXWA.ttf',
            bold: 'https://fonts.gstatic.com/s/gochihand/v19/hES06XlsOjtJsgCkx1PkTo71-n0nXWA.ttf',
            italic: 'https://fonts.gstatic.com/s/gochihand/v19/hES06XlsOjtJsgCkx1PkTo71-n0nXWA.ttf'
        }
    },
    {
        family: 'Kristi',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/kristi/v17/uK_y4ricdeU6zwdRCh0TMv6EXw.ttf',
            bold: 'https://fonts.gstatic.com/s/kristi/v17/uK_y4ricdeU6zwdRCh0TMv6EXw.ttf',
            italic: 'https://fonts.gstatic.com/s/kristi/v17/uK_y4ricdeU6zwdRCh0TMv6EXw.ttf'
        }
    },
    {
        family: 'Give You Glory',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/giveyouglory/v15/8QIQdiHOgt3vv4LR7ahjw9-XYc1zB4ZD6rwa.ttf',
            bold: 'https://fonts.gstatic.com/s/giveyouglory/v15/8QIQdiHOgt3vv4LR7ahjw9-XYc1zB4ZD6rwa.ttf',
            italic: 'https://fonts.gstatic.com/s/giveyouglory/v15/8QIQdiHOgt3vv4LR7ahjw9-XYc1zB4ZD6rwa.ttf'
        }
    },
    {
        family: 'Mr Dafoe',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/mrdafoe/v14/lJwE-pIzkS5NXuMMrGiqg7MCxz_C.ttf',
            bold: 'https://fonts.gstatic.com/s/mrdafoe/v14/lJwE-pIzkS5NXuMMrGiqg7MCxz_C.ttf',
            italic: 'https://fonts.gstatic.com/s/mrdafoe/v14/lJwE-pIzkS5NXuMMrGiqg7MCxz_C.ttf'
        }
    },
    {
        family: 'Kaushan Script',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/kaushanscript/v14/vm8vdRfvXFLG3OLnsO15WYS5DF7_ytN3M48a.ttf',
            bold: 'https://fonts.gstatic.com/s/kaushanscript/v14/vm8vdRfvXFLG3OLnsO15WYS5DF7_ytN3M48a.ttf',
            italic: 'https://fonts.gstatic.com/s/kaushanscript/v14/vm8vdRfvXFLG3OLnsO15WYS5DF7_ytN3M48a.ttf'
        }
    },
    {
        family: 'Cookie',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/cookie/v17/syky-y18lb0tSbfNlQCT9tPdpw.ttf',
            bold: 'https://fonts.gstatic.com/s/cookie/v17/syky-y18lb0tSbfNlQCT9tPdpw.ttf',
            italic: 'https://fonts.gstatic.com/s/cookie/v17/syky-y18lb0tSbfNlQCT9tPdpw.ttf'
        }
    },
    {
        family: 'Dawning of a New Day',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/dawningofanewday/v16/t5t_IQMbOp2SEwuncwLRjMfIg1yYit_nAz8bhWJGNoBE.ttf',
            bold: 'https://fonts.gstatic.com/s/dawningofanewday/v16/t5t_IQMbOp2SEwuncwLRjMfIg1yYit_nAz8bhWJGNoBE.ttf',
            italic: 'https://fonts.gstatic.com/s/dawningofanewday/v16/t5t_IQMbOp2SEwuncwLRjMfIg1yYit_nAz8bhWJGNoBE.ttf'
        }
    },
    {
        family: 'Over the Rainbow',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/overtherainbow/v18/11haGoXG1k_HKhMLUWz7Mc7vvW5upvOm9NA.ttf',
            bold: 'https://fonts.gstatic.com/s/overtherainbow/v18/11haGoXG1k_HKhMLUWz7Mc7vvW5upvOm9NA.ttf',
            italic: 'https://fonts.gstatic.com/s/overtherainbow/v18/11haGoXG1k_HKhMLUWz7Mc7vvW5upvOm9NA.ttf'
        }
    },
    {
        family: 'Shadows Into Light Two',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/shadowsintolighttwo/v14/4iC86LVlZsRSjQhpWGedwyOoW-0A6_kpsyNmlAvNGLNnIF0.ttf',
            bold: 'https://fonts.gstatic.com/s/shadowsintolighttwo/v14/4iC86LVlZsRSjQhpWGedwyOoW-0A6_kpsyNmlAvNGLNnIF0.ttf',
            italic: 'https://fonts.gstatic.com/s/shadowsintolighttwo/v14/4iC86LVlZsRSjQhpWGedwyOoW-0A6_kpsyNmlAvNGLNnIF0.ttf'
        }
    },
    {
        family: 'Rancho',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/rancho/v16/46kulbzmXjLaqZRlbWXgd0RY1g.ttf',
            bold: 'https://fonts.gstatic.com/s/rancho/v16/46kulbzmXjLaqZRlbWXgd0RY1g.ttf',
            italic: 'https://fonts.gstatic.com/s/rancho/v16/46kulbzmXjLaqZRlbWXgd0RY1g.ttf'
        }
    },
    {
        family: 'Loved by the King',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/lovedbytheking/v17/Gw6jwczl81XcIZuckK_e3UpfdzxrldyFvm1n.ttf',
            bold: 'https://fonts.gstatic.com/s/lovedbytheking/v17/Gw6jwczl81XcIZuckK_e3UpfdzxrldyFvm1n.ttf',
            italic: 'https://fonts.gstatic.com/s/lovedbytheking/v17/Gw6jwczl81XcIZuckK_e3UpfdzxrldyFvm1n.ttf'
        }
    },
    {
        family: 'Yellowtail',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/yellowtail/v18/OZpGg_pnoDtINPfRIlLotlzNwED-b4g.ttf',
            bold: 'https://fonts.gstatic.com/s/yellowtail/v18/OZpGg_pnoDtINPfRIlLotlzNwED-b4g.ttf',
            italic: 'https://fonts.gstatic.com/s/yellowtail/v18/OZpGg_pnoDtINPfRIlLotlzNwED-b4g.ttf'
        }
    },
    {
        family: 'La Belle Aurore',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/labelleaurore/v16/RrQIbot8-mNYKnGNDkWlocovHeIIG-eFNVmULg.ttf',
            bold: 'https://fonts.gstatic.com/s/labelleaurore/v16/RrQIbot8-mNYKnGNDkWlocovHeIIG-eFNVmULg.ttf',
            italic: 'https://fonts.gstatic.com/s/labelleaurore/v16/RrQIbot8-mNYKnGNDkWlocovHeIIG-eFNVmULg.ttf'
        }
    },
    {
        family: 'Delius',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/delius/v19/PN_xRfK0pW_9e1rtYcI-jT3L_w.ttf',
            bold: 'https://fonts.gstatic.com/s/delius/v19/PN_xRfK0pW_9e1rtYcI-jT3L_w.ttf',
            italic: 'https://fonts.gstatic.com/s/delius/v19/PN_xRfK0pW_9e1rtYcI-jT3L_w.ttf'
        }
    },
    {
        family: 'Allura',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/allura/v19/9oRPNYsQpS4zjuAPjAIXPtrrGA.ttf',
            bold: 'https://fonts.gstatic.com/s/allura/v19/9oRPNYsQpS4zjuAPjAIXPtrrGA.ttf',
            italic: 'https://fonts.gstatic.com/s/allura/v19/9oRPNYsQpS4zjuAPjAIXPtrrGA.ttf'
        }
    },
    {
        family: 'Cedarville Cursive',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/cedarvillecursive/v17/yYL00g_a2veiudhUmxjo5VKkoqA-B_neJbBxw8BeTg.ttf',
            bold: 'https://fonts.gstatic.com/s/cedarvillecursive/v17/yYL00g_a2veiudhUmxjo5VKkoqA-B_neJbBxw8BeTg.ttf',
            italic: 'https://fonts.gstatic.com/s/cedarvillecursive/v17/yYL00g_a2veiudhUmxjo5VKkoqA-B_neJbBxw8BeTg.ttf'
        }
    },
    {
        family: 'Damion',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/damion/v14/hv-XlzJ3KEUe_YZUbWY3MTFgVg.ttf',
            bold: 'https://fonts.gstatic.com/s/damion/v14/hv-XlzJ3KEUe_YZUbWY3MTFgVg.ttf',
            italic: 'https://fonts.gstatic.com/s/damion/v14/hv-XlzJ3KEUe_YZUbWY3MTFgVg.ttf'
        }
    },
    {
        family: 'Grand Hotel',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/grandhotel/v14/7Au7p_IgjDKdCRWuR1azpmQNEl0O0kEx.ttf',
            bold: 'https://fonts.gstatic.com/s/grandhotel/v14/7Au7p_IgjDKdCRWuR1azpmQNEl0O0kEx.ttf',
            italic: 'https://fonts.gstatic.com/s/grandhotel/v14/7Au7p_IgjDKdCRWuR1azpmQNEl0O0kEx.ttf'
        }
    },
    {
        family: 'Sacramento',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/sacramento/v13/buEzpo6gcdjy0EiZMBUG0CoV_NxLeiw.ttf',
            bold: 'https://fonts.gstatic.com/s/sacramento/v13/buEzpo6gcdjy0EiZMBUG0CoV_NxLeiw.ttf',
            italic: 'https://fonts.gstatic.com/s/sacramento/v13/buEzpo6gcdjy0EiZMBUG0CoV_NxLeiw.ttf'
        }
    },
    {
        family: 'Alex Brush',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/alexbrush/v20/SZc83FzrJKuqFbwMKk6EhUXz6_kG7w.ttf',
            bold: 'https://fonts.gstatic.com/s/alexbrush/v20/SZc83FzrJKuqFbwMKk6EhUXz6_kG7w.ttf',
            italic: 'https://fonts.gstatic.com/s/alexbrush/v20/SZc83FzrJKuqFbwMKk6EhUXz6_kG7w.ttf'
        }
    },
    {
        family: 'Marck Script',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/marckscript/v17/nwpTtK2oNgBA3Or78gapdwuCzyI-aMPF7Q.ttf',
            bold: 'https://fonts.gstatic.com/s/marckscript/v17/nwpTtK2oNgBA3Or78gapdwuCzyI-aMPF7Q.ttf',
            italic: 'https://fonts.gstatic.com/s/marckscript/v17/nwpTtK2oNgBA3Or78gapdwuCzyI-aMPF7Q.ttf'
        }
    },
    {
        family: 'Tangerine',
        variants: ['regular', 'bold'],
        files: {
            regular: 'https://fonts.gstatic.com/s/tangerine/v17/IurY6Y5j_oScZZow4VOBDpxNhLBQ4Q.ttf',
            bold: 'https://fonts.gstatic.com/s/tangerine/v17/Iurd6Y5j_oScZZow4VO5srNpjJtM6G0t9w.ttf',
            italic: 'https://fonts.gstatic.com/s/tangerine/v17/IurY6Y5j_oScZZow4VOBDpxNhLBQ4Q.ttf'
        }
    },
    {
        family: 'Pinyon Script',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/pinyonscript/v19/6xKpdSJbL9-e9LuoeQiDRQR8aOLQO4bhiDY.ttf',
            bold: 'https://fonts.gstatic.com/s/pinyonscript/v19/6xKpdSJbL9-e9LuoeQiDRQR8aOLQO4bhiDY.ttf',
            italic: 'https://fonts.gstatic.com/s/pinyonscript/v19/6xKpdSJbL9-e9LuoeQiDRQR8aOLQO4bhiDY.ttf'
        }
    },
    {
        family: 'Ribeye Marrow',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/ribeyemarrow/v22/GFDsWApshnqMRO2JdtRZ2d0vEAwTVWgKdtw.ttf',
            bold: 'https://fonts.gstatic.com/s/ribeyemarrow/v22/GFDsWApshnqMRO2JdtRZ2d0vEAwTVWgKdtw.ttf',
            italic: 'https://fonts.gstatic.com/s/ribeyemarrow/v22/GFDsWApshnqMRO2JdtRZ2d0vEAwTVWgKdtw.ttf'
        }
    },
    {
        family: 'Fredericka the Great',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/frederickathegreat/v15/9Bt33CxNwt7aOctW2xjbCstzwVKsIBVV-9Skz7Ylch2L.ttf',
            bold: 'https://fonts.gstatic.com/s/frederickathegreat/v15/9Bt33CxNwt7aOctW2xjbCstzwVKsIBVV-9Skz7Ylch2L.ttf',
            italic: 'https://fonts.gstatic.com/s/frederickathegreat/v15/9Bt33CxNwt7aOctW2xjbCstzwVKsIBVV-9Skz7Ylch2L.ttf'
        }
    },
    {
        family: 'Zeyada',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/zeyada/v15/11hAGpPTxVPUbgZDNGatWKaZ3w.ttf',
            bold: 'https://fonts.gstatic.com/s/zeyada/v15/11hAGpPTxVPUbgZDNGatWKaZ3w.ttf',
            italic: 'https://fonts.gstatic.com/s/zeyada/v15/11hAGpPTxVPUbgZDNGatWKaZ3w.ttf'
        }
    },
    {
        family: 'Fondamento',
        variants: ['regular', 'italic'],
        files: {
            regular: 'https://fonts.gstatic.com/s/fondamento/v16/4UaHrEJGsxNmFTPDnkaJx63j5pN1MwI.ttf',
            bold: 'https://fonts.gstatic.com/s/fondamento/v16/4UaHrEJGsxNmFTPDnkaJx63j5pN1MwI.ttf',
            italic: 'https://fonts.gstatic.com/s/fondamento/v16/4UaFrEJGsxNmFTPDnkaJ96_p4rFwIwJePw.ttf'
        }
    },
    {
        family: 'Montez',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/montez/v18/845ZNMk5GoGIX8lm1LDeSd-R_g.ttf',
            bold: 'https://fonts.gstatic.com/s/montez/v18/845ZNMk5GoGIX8lm1LDeSd-R_g.ttf',
            italic: 'https://fonts.gstatic.com/s/montez/v18/845ZNMk5GoGIX8lm1LDeSd-R_g.ttf'
        }
    },
    {
        family: 'Norican',
        variants: ['regular'],
        files: {
            regular: 'https://fonts.gstatic.com/s/norican/v14/MwQ2bhXp1eSBqjkPGJJRtGs-lbA.ttf',
            bold: 'https://fonts.gstatic.com/s/norican/v14/MwQ2bhXp1eSBqjkPGJJRtGs-lbA.ttf',
            italic: 'https://fonts.gstatic.com/s/norican/v14/MwQ2bhXp1eSBqjkPGJJRtGs-lbA.ttf'
        }
    }
];

export const AVAILABLE_FONTS = FONTS.map(f => f.family);
