import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Container from "@mui/material/Container";
import Link from "@mui/material/Link";

function Copyright() {
  return (
    <Typography variant='body2' color='text.secondary'>
      {"Copyright © "}
      <Link color='inherit' href='https://material-ui.com/'>

      </Link>{" "}
      <b> Mosaics </b> {"- Version B_001 - 2025."}


    </Typography>
  );
}

export default function Footer() {
  return (


    <Box
      component='footer'
      sx={{
        py: 3,
        px: 2,
        mt: "auto",
        textAlign: "center",
        backgroundColor: (theme) =>
          theme.palette.mode === "light"
            ? theme.palette.grey[200]
            : theme.palette.grey[800],
      }}
    >
      <Container maxWidth='sm'>
        <Typography variant='body1'></Typography>
        <Copyright />
      </Container>
    </Box>

  );
}
