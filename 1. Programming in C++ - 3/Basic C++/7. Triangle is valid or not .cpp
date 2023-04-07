#include <iostream>
using namespace std;
int  tri( int a, int b, int c);

int main()
{
    int ang,x,y,z;
    cout<<"Input of the 1st angle = ";
    cin>> x;
    cout<<"Input of the 2nd angle = ";
    cin>> y;
    cout<<"Input of the 3rd angle = ";
    cin>> z;

    ang= tri(x,y,z);
    cout<<"**Total angle is **="<<ang <<endl;

    if(ang== 180)
    {
        cout<< "Triangle is valid";
    }
    else{
           cout<< "Triangle is  not  valid";
    }

}
int  tri( int a, int b, int c)
{
    int r;
    r=(a+b+c);
    return r;
}
